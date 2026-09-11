"""
LLM Client — Unified interface for Ollama, Groq and Gemini
============================================================
Provides a single call_llm() function with:
- Token counting and logging
- Automatic fallback: Ollama → Groq → Gemini
- Retry logic with exponential backoff
- Chain-of-thought extraction

Ollama comes first by design. The project's premise is that the analysis runs
on data its owner may not be permitted to upload, which rules out a third-party
API for the confidential case. Pointing OLLAMA_HOST at a local daemon keeps
every token on the machine; OLLAMA_API_KEY uses the hosted service for when the
data is not sensitive and the local hardware is not enough.
"""
import os
import time
import json
import logging
from typing import Optional, Tuple

from observability.langsmith_tracer import trace_llm_call

logger = logging.getLogger(__name__)

# Ollama model selection. A4 and A9 write code and get the code-tuned model;
# everything else gets the general one. Both are overridable so a local daemon
# can be pointed at whatever weights are actually pulled.
OLLAMA_MODEL      = os.getenv("OLLAMA_MODEL", "gpt-oss:120b")
OLLAMA_CODE_MODEL = os.getenv("OLLAMA_CODE_MODEL", "kimi-k2.7-code")
OLLAMA_TIMEOUT_S  = int(os.getenv("OLLAMA_TIMEOUT_S", "180"))


def _ollama_config():
    """
    Resolve which Ollama endpoint to talk to, if any.

    A local daemon wins over the hosted one: if someone has gone to the trouble
    of running Ollama locally that is the stronger privacy guarantee, and it is
    the arrangement the architecture is built around.
    """
    local = os.getenv("OLLAMA_HOST", "").strip().rstrip("/")
    api_key = os.getenv("OLLAMA_API_KEY", "").strip()

    if local:
        return {"base_url": local, "api_key": None, "label": "ollama-local"}
    if api_key:
        host = os.getenv("OLLAMA_CLOUD_HOST", "https://ollama.com").rstrip("/")
        return {"base_url": host, "api_key": api_key, "label": "ollama-cloud"}
    return None


def _call_ollama(system_prompt, user_prompt, temperature, max_tokens,
                 json_mode, model_name, config):
    """
    One call against Ollama's OpenAI-compatible endpoint.

    The OpenAI shape is used rather than Ollama's native /api/chat because it
    reports prompt and completion token counts, which the telemetry and the
    meta-agent both depend on.
    """
    import requests

    headers = {"Content-Type": "application/json"}
    if config["api_key"]:
        headers["Authorization"] = "Bearer " + config["api_key"]

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    resp = requests.post(
        config["base_url"] + "/v1/chat/completions",
        headers=headers, json=payload, timeout=OLLAMA_TIMEOUT_S,
    )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(str(data["error"]))

    text = data["choices"][0]["message"]["content"] or ""
    usage = data.get("usage") or {}
    tokens = usage.get("total_tokens") or (
        usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)
    )
    return text, int(tokens)


def call_llm(
    system_prompt: str,
    user_prompt: str,
    model: str = "groq",           # "groq" | "gemini"
    temperature: float = 0.2,
    max_tokens: int = 4096,
    json_mode: bool = False,
    extract_thinking: bool = False,
    retries: int = 3,
    task: str = "general",         # "general" | "code" — picks the Ollama model
) -> Tuple[str, int]:
    """
    Unified LLM caller.
    Returns: (response_text, tokens_used)
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    ollama = _ollama_config()

    # -- Ollama first: local if configured, hosted otherwise ------------------
    if ollama:
        # The code-tuned model is preferred for pandas/SQL, but on Ollama Cloud
        # it may sit behind a paid tier and answer 402. That is a billing fact,
        # not a reason to fail an analysis, so the general model is kept as a
        # second candidate and only a genuine outage falls through to Groq.
        candidates = []
        if task == "code" and OLLAMA_CODE_MODEL != OLLAMA_MODEL:
            candidates.append(OLLAMA_CODE_MODEL)
        candidates.append(OLLAMA_MODEL)

        for model_name in candidates:
            unavailable = False
            for attempt in range(retries):
                start_time = time.perf_counter()
                try:
                    text, tokens = _call_ollama(
                        system_prompt, user_prompt, temperature,
                        max_tokens, json_mode, model_name, ollama,
                    )
                    latency = (time.perf_counter() - start_time) * 1000
                    logger.info("[%s:%s] tokens=%s", ollama["label"], model_name, tokens)

                    trace_llm_call(
                        agent_name="Agent",
                        prompt=system_prompt + "\n\n" + user_prompt,
                        response=text,
                        tokens=tokens,
                        latency_ms=latency,
                        session_id="unknown",
                        model=ollama["label"] + "/" + model_name,
                    )
                    return text.strip(), tokens

                except Exception as e:
                    # 402/403/404 mean this model is not available to this key.
                    # Retrying will not change that — move to the next candidate.
                    status = getattr(getattr(e, "response", None), "status_code", None)
                    if status in (401, 402, 403, 404):
                        logger.warning(
                            "[%s] %s unavailable (HTTP %s) — trying the next model",
                            ollama["label"], model_name, status,
                        )
                        unavailable = True
                        break
                    logger.warning(
                        "[%s:%s] attempt %s failed: %s",
                        ollama["label"], model_name, attempt + 1, e,
                    )
                    if attempt < retries - 1:
                        time.sleep(2 ** attempt)

            if not unavailable:
                # The model exists but kept erroring; another candidate will not help.
                break

    # ── Try Groq first ────────────────────────────────────────────────────────
    if model == "groq" and groq_key:
        for attempt in range(retries):
            start_time = time.perf_counter()
            try:
                from groq import Groq
                client = Groq(api_key=groq_key)
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt},
                ]
                kwargs = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                response = client.chat.completions.create(**kwargs)
                text = response.choices[0].message.content or ""
                tokens = response.usage.total_tokens if response.usage else 0
                latency = (time.perf_counter() - start_time) * 1000 if 'start_time' in locals() else 0
                logger.info(f"[Groq] tokens={tokens}")
                
                # Trace LLM call
                session_id = "unknown"  # Will be extracted contextually if needed or passed via kwargs in future
                trace_llm_call(
                    agent_name="Agent",
                    prompt=system_prompt + "\n\n" + user_prompt,
                    response=text,
                    tokens=tokens,
                    latency_ms=latency,
                    session_id=session_id,
                    model="groq/llama-3.3-70b-versatile"
                )
                
                return text.strip(), tokens

            except Exception as e:
                logger.warning(f"[Groq] attempt {attempt+1} failed: {e}")
                time.sleep(2 ** attempt)

    # ── Fallback to Gemini ────────────────────────────────────────────────────
    if gemini_key:
        for attempt in range(retries):
            start_time = time.perf_counter()
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)
                gmodel = genai.GenerativeModel("gemini-1.5-flash")
                full_prompt = f"{system_prompt}\n\n{user_prompt}"
                resp = gmodel.generate_content(full_prompt)
                text = resp.text or ""
                # Gemini doesn't always give token count in free tier
                tokens = len(full_prompt.split()) + len(text.split())
                latency = (time.perf_counter() - start_time) * 1000
                logger.info(f"[Gemini] approx_tokens={tokens}")
                
                trace_llm_call(
                    agent_name="Agent",
                    prompt=full_prompt,
                    response=text,
                    tokens=tokens,
                    latency_ms=latency,
                    session_id="unknown",
                    model="gemini/gemini-1.5-flash"
                )
                
                return text.strip(), tokens
            except Exception as e:
                logger.warning(f"[Gemini] attempt {attempt+1} failed: {e}")
                time.sleep(2 ** attempt)

    # ── No LLM available — raise clear error ─────────────────────────────────
    raise RuntimeError(
        "No model available. Set one of these in backend/.env:\n"
        "  OLLAMA_HOST=http://localhost:11434   (fully local, no data leaves the machine)\n"
        "  OLLAMA_API_KEY=...                   (Ollama Cloud)\n"
        "  GROQ_API_KEY=...\n"
        "  GEMINI_API_KEY=..."
    )


def extract_json_from_response(text: str) -> dict:
    """Robustly extract JSON from LLM response, even with markdown fences."""
    # Strip markdown code fences if present
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed: {e}\nRaw text: {text[:500]}")
        raise ValueError(f"LLM returned invalid JSON: {e}")
