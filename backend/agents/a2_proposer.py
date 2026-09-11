"""
A2 — Proposer (LLM + RAG)
==========================
NATURE: LLM (Groq/Gemini) with optional RAG from data dictionary
ROLE: Reads the A1 profile and proposes testable, falsifiable hypotheses.
     Accepts user-defined natural language hypotheses as additional inputs.
     Uses RAG if a data dictionary was uploaded.
"""
import json
import logging
import re
import time

from core.ledger import Ledger, HypothesisEntry, PipelineStage
from core.llm_client import call_llm, extract_json_from_response
from prompts.templates import get_prompt
from observability.telemetry import timed_agent

logger = logging.getLogger(__name__)

MAX_PROFILE_CHARS = 8000  # Token budget — truncate profile if too large


def _truncate_profile(profile_json: str) -> str:
    """Token optimization: trim profile if it exceeds context budget."""
    if len(profile_json) <= MAX_PROFILE_CHARS:
        return profile_json
    logger.warning("[A2] Profile truncated for token budget")
    return profile_json[:MAX_PROFILE_CHARS] + "\n... [truncated for token budget]"


def _infer_columns(statement: str, df_columns: list) -> list:
    """
    Work out which columns a plain-English hypothesis is about.

    User-submitted hypotheses arrive as a sentence with no column list, and the
    registry needs one before the freeze. This is deliberately deterministic and
    deliberately not a model call: a model asked to name columns after reading
    the hypothesis would be making a data-dependent choice at exactly the moment
    the architecture forbids one.

    Matching is on stems rather than whole words, so "pay more per month" finds
    `monthly_charges`. Identifier-ish columns are penalised, because "Customers
    on month-to-month contracts" otherwise matches `customer_id` on the word
    "customers" and beats the column the sentence is actually about.
    """
    ID_LIKE = ("id", "uuid", "key", "index", "idx", "code", "guid")
    STOP = {"the", "and", "for", "with", "are", "was", "per", "than", "then",
            "more", "less", "have", "has", "who", "that", "this", "from"}

    text = re.sub(r"[^a-z0-9]+", " ", statement.lower())
    words = [w for w in text.split() if len(w) > 2 and w not in STOP]

    def stem_hit(part: str) -> bool:
        """A word matches a column part if either is a prefix of the other."""
        for w in words:
            if w == part:
                return True
            short, long = (w, part) if len(w) < len(part) else (part, w)
            if len(short) >= 4 and long.startswith(short):
                return True
        return False

    scored = []
    for col in df_columns:
        col_l = str(col).lower()
        col_spaced = re.sub(r"[^a-z0-9]+", " ", col_l).strip()
        tokens = col_spaced.split()
        parts = [p for p in tokens if len(p) > 2]

        if col_spaced and col_spaced in text:
            score = 100 + len(col_spaced)              # the full name, as written
        elif parts:
            hits = sum(1 for part in parts if stem_hit(part))
            if hits == len(parts):
                score = 60 + len(col_spaced)           # every part present
            elif hits:
                score = 15 * hits                      # partial — weak evidence
            else:
                score = 0
        else:
            score = 0

        # An id column is almost never the subject of a hypothesis; it matches
        # on incidental words like "customers" far more often than it is meant.
        # An identifier is never the subject of a statistical hypothesis unless
        # it is named outright — and it matches on incidental words like
        # "customers" constantly. So a partial match against an id column is
        # dropped rather than merely down-weighted. (Check the raw tokens, not
        # `parts`: "id" is two characters and is filtered out above.)
        if score < 100 and any(tok in ID_LIKE for tok in tokens):
            score = 0

        if score > 0:
            scored.append((score, str(col)))

    scored.sort(key=lambda t: (-t[0], t[1]))
    return [c for _, c in scored[:2]]


def run(
    ledger: Ledger,
    user_hypotheses: list[str] | None = None,
) -> Ledger:
    """
    A2: Propose testable hypotheses from the dataset profile.
    
    Args:
        ledger: Ledger with _profile_json set by A1.
        user_hypotheses: Optional list of plain-English hypotheses from the user.
    
    Returns:
        Updated ledger with HypothesisEntry objects (not yet frozen).
    """
    with timed_agent(ledger.session_id, "A2_PROPOSER") as ctx:
        ledger.advance_stage(PipelineStage.PROPOSER)
        start = time.perf_counter()

        profile_json = getattr(ledger, "_profile_json", "{}")
        profile_trimmed = _truncate_profile(profile_json)

        # ── RAG context from uploaded data dictionary ──────────────────────
        rag_context = ""
        if ledger.dataset and ledger.dataset.rag_context:
            rag_context = f"\nDATA DICTIONARY (use this to understand column meanings):\n{ledger.dataset.rag_context}\n"

        system_prompt = get_prompt("A2_SYSTEM")
        user_prompt = get_prompt("A2_USER").format(
            profile_json=profile_trimmed,
            rag_context=rag_context,
        )

        response_text, tokens = call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            json_mode=True,
        )

        ledger.total_tokens_used += tokens
        ledger.llm_call_count += 1

        data = extract_json_from_response(response_text)
        proposed = data.get("hypotheses", [])

        # ── Add LLM-proposed hypotheses ────────────────────────────────────
        for h in proposed:
            entry = HypothesisEntry(
                id=h.get("id", f"H{len(ledger.hypotheses)+1:02d}"),
                statement=h.get("statement", ""),
                columns_involved=h.get("columns_involved", []),
                test_type_hint=h.get("test_type_hint"),
                user_defined=False,
            )
            try:
                ledger.add_hypothesis(entry)
            except ValueError as e:
                logger.warning(f"[A2] Could not add hypothesis: {e}")

        # ── Add user-defined hypotheses ────────────────────────────────────
        if user_hypotheses:
            available = list(ledger._cleaned_df.columns) if getattr(ledger, "_cleaned_df", None) is not None else []
            for i, user_h in enumerate(user_hypotheses):
                inferred = _infer_columns(user_h, available)
                if len(inferred) < 2:
                    # Registering a hypothesis whose columns cannot be resolved
                    # would put an entry in the family that can never be tested,
                    # inflating m and making the correction more permissive for
                    # everything else. Better to refuse it and say so.
                    logger.warning(
                        "[A2] User hypothesis %r matched %d columns (need 2) — not registered. "
                        "Name the columns explicitly to have it tested.",
                        user_h, len(inferred),
                    )
                    continue

                entry = HypothesisEntry(
                    id=f"UH{i+1:02d}",
                    statement=user_h,
                    columns_involved=inferred,
                    user_defined=True,
                )
                try:
                    ledger.add_hypothesis(entry)
                    logger.info("[A2] User hypothesis %s → columns %s", entry.id, inferred)
                except ValueError as e:
                    logger.warning(f"[A2] User hypothesis blocked: {e}")

        ctx["output"] = f"Proposed {len(ledger.hypotheses)} hypotheses ({tokens} tokens)"
        ctx["tokens"] = tokens
        logger.info(f"[A2] Proposed {len(ledger.hypotheses)} hypotheses in {(time.perf_counter()-start)*1000:.0f}ms")

    return ledger
