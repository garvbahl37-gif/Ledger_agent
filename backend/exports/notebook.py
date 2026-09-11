"""
Jupyter Notebook Export
========================
Rebuilds a session as a runnable notebook.

The point is not convenience, it is falsifiability. A reader who doubts a claim
can open this file, run the cell that produced it against their own copy of the
data, and get the same number or find out that they do not. Every registered
hypothesis gets a cell — including the ones that failed — because the family is
what the correction was computed over, and a notebook containing only the
survivors would not reproduce the adjusted p-values.
"""
from __future__ import annotations

from typing import Any, Dict, List

from core.ledger import Ledger, HypothesisStatus


def _md(source: str) -> Dict[str, Any]:
    return {"cell_type": "markdown", "metadata": {}, "source": source.splitlines(keepends=True)}


def _code(source: str) -> Dict[str, Any]:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source.splitlines(keepends=True),
    }


def build_notebook(ledger: Ledger) -> Dict[str, Any]:
    """Serialise a completed session into nbformat 4.4."""
    ds = ledger.dataset
    filename = ds.filename if ds else "your_data.csv"
    supported = ledger.get_supported_hypotheses()
    cells: List[Dict[str, Any]] = []

    cells.append(_md(
        f"# Ledger analysis — `{filename}`\n"
        f"\n"
        f"Session `{ledger.session_id}`  \n"
        f"Registry hash `{ledger.registry_hash or '—'}`  \n"
        f"Reproducibility hash `{ledger.compute_final_hash()}`\n"
        f"\n"
        f"{len(ledger.hypotheses)} hypotheses were registered before any test ran. "
        f"{len(supported)} survived Benjamini–Hochberg correction at q = 0.05.\n"
        f"\n"
        f"Every registered hypothesis appears below, including the ones that were not "
        f"supported. That is deliberate: the correction was computed across the whole "
        f"family, so dropping the failures would change the adjusted p-values and the "
        f"numbers here would stop matching the report.\n"
    ))

    cells.append(_code(
        "import pandas as pd\n"
        "import numpy as np\n"
        "from scipy import stats\n"
        "from statsmodels.stats.multitest import multipletests\n"
        "\n"
        f"df = pd.read_csv({filename!r})\n"
        "df.head()\n"
    ))

    if ds and ds.columns:
        rows = "\n".join(
            f"| `{c.name}` | {c.dtype} | {c.n_unique:,} | {c.missing_pct:.1f}% |"
            for c in ds.columns
        )
        cells.append(_md(
            "## The profile\n"
            "\n"
            "Marginal summaries only — no relationships between columns were computed at this "
            "stage, so the hypotheses below could not have been chosen by peeking at the answer.\n"
            "\n"
            "| column | dtype | unique | missing |\n"
            "|---|---|---|---|\n"
            f"{rows}\n"
        ))

    cells.append(_md(
        "## The registry\n"
        "\n"
        f"Frozen at hash `{ledger.registry_hash or '—'}`. Nothing was added after this point.\n"
    ))

    for h in ledger.hypotheses:
        r = h.statistical_result
        verdict = h.status.value if hasattr(h.status, "value") else str(h.status)

        header = f"### {h.id} — {h.statement}\n\n**Verdict: {verdict}**"
        if h.user_defined:
            header += " · submitted by the analyst"
        cells.append(_md(header + "\n"))

        attempt = h.execution_attempts[-1] if h.execution_attempts else None
        if attempt and attempt.code:
            cells.append(_code(attempt.code))
            if len(h.execution_attempts) > 1:
                cells.append(_md(
                    f"_The executor repaired this code {len(h.execution_attempts) - 1} time(s) "
                    f"against real tracebacks before it ran._\n"
                ))

        if r:
            lines = [
                "**Adjudication** — assumptions were checked first, and the test was selected "
                "from what they returned rather than proposed by a model.\n",
                "",
                "| | |",
                "|---|---|",
                f"| test selected | {r.test_name} |",
                f"| statistic | {r.statistic:.6g} |",
                f"| raw p | {r.raw_p_value:.6g} |",
            ]
            if r.fdr_adjusted_p_value is not None:
                lines.append(f"| BH-adjusted p | {r.fdr_adjusted_p_value:.6g} |")
            if r.effect_size is not None:
                lines.append(f"| effect size | {r.effect_size:.4g} ({r.effect_size_label}) |")
            for a in r.assumptions:
                state = "holds" if a.passed else "violated"
                detail = f", p = {a.p_value:.4g}" if a.p_value is not None else ""
                lines.append(f"| {a.name} | {state}{detail} |")

            if r.licensed_text:
                lines += [
                    "",
                    "**Licensed text** — the only sentence the reporter was permitted to write "
                    "for this entry:",
                    "",
                    f"> {r.licensed_text}",
                ]
            cells.append(_md("\n".join(lines) + "\n"))
        elif verdict == "ERROR":
            cells.append(_md(
                "_No verdict was reached: the code for this hypothesis could not be made to run. "
                "It stays in the registry and still counts toward the correction._\n"
            ))

    p_values = [
        h.statistical_result.raw_p_value
        for h in ledger.hypotheses
        if h.statistical_result
    ]
    if p_values:
        cells.append(_md(
            "## Reproducing the correction\n"
            "\n"
            "Benjamini–Hochberg is applied once across the whole family, not per test. Run this "
            "to confirm the adjusted p-values in the report.\n"
        ))
        ids = [h.id for h in ledger.hypotheses if h.statistical_result]
        cells.append(_code(
            f"ids = {ids!r}\n"
            f"p_raw = {[round(p, 12) for p in p_values]!r}\n"
            "\n"
            "reject, p_adj, _, _ = multipletests(p_raw, alpha=0.05, method='fdr_bh')\n"
            "\n"
            "pd.DataFrame({\n"
            "    'hypothesis': ids,\n"
            "    'p_raw': p_raw,\n"
            "    'p_adjusted': p_adj,\n"
            "    'supported': reject,\n"
            "}).sort_values('p_raw').reset_index(drop=True)\n"
        ))

    if ledger.report_html:
        cells.append(_md("## The report\n"))
        cells.append(_code(
            "from IPython.display import HTML\n"
            f"HTML({ledger.report_html!r})\n"
        ))

    if ledger.adversary_violations:
        flags = "\n".join(
            f"- **{v.violation_type}** ({v.severity}) — {v.sentence}"
            for v in ledger.adversary_violations
        )
        cells.append(_md(
            "## What the red team flagged\n"
            "\n"
            f"{flags}\n"
        ))

    return {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.12"},
            "ledger": {
                "session_id": ledger.session_id,
                "registry_hash": ledger.registry_hash,
                "reproducibility_hash": ledger.compute_final_hash(),
            },
        },
        "nbformat": 4,
        "nbformat_minor": 4,
    }
