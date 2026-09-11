"""
A4 — Executor (LLM + ReAct Self-Repair Loop)
==============================================
NATURE: LLM with ReAct loop (Reason → Act → Observe → Repair)
ROLE: For each registered hypothesis, writes Pandas code, executes it in the
      sandbox, and self-repairs up to MAX_REPAIR_ATTEMPTS times on failure.
      All attempts are logged for A8's self-improving loop.
"""
import json
import logging
import time
from typing import Optional

import pandas as pd

from core.ledger import Ledger, HypothesisEntry, ExecutionAttempt, HypothesisStatus, PipelineStage
from core.sandbox import run_sandboxed
from core.llm_client import call_llm
from prompts.templates import get_prompt
from observability.telemetry import timed_agent, log_hypothesis_event

logger = logging.getLogger(__name__)

MAX_REPAIR_ATTEMPTS = 3


def _build_schema_string(df: pd.DataFrame) -> str:
    """Compact schema representation for the LLM prompt."""
    lines = [f"Shape: {df.shape[0]} rows x {df.shape[1]} cols\n"]
    for col in df.columns:
        dtype = str(df[col].dtype)
        sample = df[col].dropna().head(3).tolist()
        lines.append(f"  - {col} ({dtype}): sample={sample}")
    return "\n".join(lines)


def _execute_with_repair(
    ledger: Ledger,
    hypothesis: HypothesisEntry,
    df: pd.DataFrame,
) -> HypothesisEntry:
    """
    ReAct loop: Generate code → Run → Observe → Repair on failure.
    Up to MAX_REPAIR_ATTEMPTS iterations.
    """
    schema = _build_schema_string(df)
    df_context = {"df": df.copy()}
    previous_code = None
    previous_error = None

    for attempt_num in range(1, MAX_REPAIR_ATTEMPTS + 1):
        # ── REASON + ACT: Generate code ───────────────────────────────────
        if attempt_num == 1:
            system_prompt = get_prompt("A4_SYSTEM")
            user_prompt = get_prompt("A4_USER").format(
                statement=hypothesis.statement,
                columns=", ".join(hypothesis.columns_involved),
                schema=schema,
            )
        else:
            # REPAIR: Feed error back to LLM
            logger.info(f"[A4] {hypothesis.id} repair attempt {attempt_num}")
            system_prompt = get_prompt("A4_REPAIR_SYSTEM")
            user_prompt = get_prompt("A4_REPAIR_USER").format(
                previous_code=previous_code,
                error=previous_error,
            )

        code, tokens = call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
            max_tokens=2048,
            task="code",   # pandas/SQL generation gets the code-tuned model
        )
        ledger.total_tokens_used += tokens
        ledger.llm_call_count += 1

        # Strip markdown fences if LLM added them
        if "```python" in code:
            code = code.split("```python")[1].split("```")[0].strip()
        elif "```" in code:
            code = code.split("```")[1].split("```")[0].strip()

        # ── OBSERVE: Run in sandbox ────────────────────────────────────────
        result = run_sandboxed(
            code=code,
            df_context=df_context,
            extract_vars=["result"],
            timeout_seconds=30,
        )

        attempt = ExecutionAttempt(
            attempt_number=attempt_num,
            code=code,
            stdout=result.stdout,
            stderr=result.stderr,
            success=result.success,
            data_extracted=result.extracted_data,
        )
        hypothesis.execution_attempts.append(attempt)

        if result.success:
            hypothesis.raw_data = result.extracted_data.get("result", {})
            ledger.self_repair_count += (attempt_num - 1)
            logger.info(f"[A4] {hypothesis.id} succeeded on attempt {attempt_num}")
            return hypothesis
        else:
            # Feed error back for next iteration
            previous_code = code
            previous_error = result.stderr
            logger.warning(f"[A4] {hypothesis.id} attempt {attempt_num} failed: {result.stderr[:200]}")

    # All attempts exhausted
    hypothesis.status = HypothesisStatus.ERROR
    ledger.self_repair_count += MAX_REPAIR_ATTEMPTS
    logger.error(f"[A4] {hypothesis.id} failed after {MAX_REPAIR_ATTEMPTS} attempts")
    return hypothesis


def run(ledger: Ledger) -> Ledger:
    """
    A4: Execute data extraction code for every registered hypothesis.
    
    Args:
        ledger: Frozen ledger with hypotheses registered by A3.
    
    Returns:
        Updated ledger with raw_data populated for each hypothesis.
    
    Raises:
        ValueError: If ledger is not frozen (A3 must run first).
    """
    if not ledger.is_frozen:
        raise ValueError(
            "[A4] Cannot execute before ledger is frozen. A3 (Registrar) must run first."
        )

    df = getattr(ledger, "_cleaned_df", None)
    if df is None:
        raise ValueError("[A4] No cleaned DataFrame found. A0 must run first.")

    ledger.advance_stage(PipelineStage.EXECUTOR)

    for hypothesis in ledger.hypotheses:
        if hypothesis.status == HypothesisStatus.ERROR:
            continue

        with timed_agent(ledger.session_id, f"A4_EXECUTOR_{hypothesis.id}") as ctx:
            hypothesis.status = HypothesisStatus.EXECUTING
            hypothesis = _execute_with_repair(ledger, hypothesis, df)
            ctx["output"] = hypothesis.status.value

    logger.info(
        f"[A4] Execution complete. "
        f"Errors: {sum(1 for h in ledger.hypotheses if h.status == HypothesisStatus.ERROR)}"
    )
    return ledger
