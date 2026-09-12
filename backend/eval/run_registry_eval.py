"""
The model-backed arms: what does the proposer actually register, and does
correcting across its registry control false discovery?

One LLM call per table, so this runs on a subset. Each table yields BOTH
registry arms from that single call, because the difference between them is
purely deterministic — the same tests, corrected or not. That is what makes a
meaningful sample affordable at all.

Usage:
    python -m eval.run_registry_eval --nullset 25 --planted 25 --out eval/results
"""
from __future__ import annotations

import argparse
import itertools
import json
import logging
import os
import sys
import time
from dataclasses import asdict
from typing import List, Tuple

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The provider credentials live in backend/.env, which only main.py loaded.
# Running the harness as a module bypasses that, so load it here too.
from dotenv import load_dotenv  # noqa: E402
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from core.ledger import Ledger                                      # noqa: E402
from agents import a0_janitor, a1_profiler, a2_proposer             # noqa: E402
from eval.generators import build_suite, Table                      # noqa: E402
from eval.harness import evaluate_registry_arms, aggregate          # noqa: E402

logging.disable(logging.CRITICAL)


def propose_registry(table: Table) -> Tuple[List[Tuple[str, str]], dict]:
    """
    Run A0 -> A1 -> A2 on a generated table and return the registered pairs.

    The profiler is deliberately left as-is: it emits marginal summaries only,
    which is the restriction that keeps the proposer from choosing hypotheses
    by peeking at relationships. Weakening it here would quietly invalidate the
    correction the next arm applies.
    """
    csv_bytes = table.df.to_csv(index=False).encode()
    ledger = Ledger(session_id=f"eval-{table.name}")

    ledger = a0_janitor.run(ledger, csv_bytes, f"{table.name}.csv")
    ledger = a1_profiler.run(ledger)
    ledger = a2_proposer.run(ledger)

    pairs: List[Tuple[str, str]] = []
    for h in ledger.hypotheses:
        cols = [c for c in (h.columns_involved or []) if c in table.df.columns]
        if len(cols) == 2:
            pairs.append((cols[0], cols[1]))
        elif len(cols) > 2:
            # A proposer naming 3+ columns describes a family, not one test;
            # enumerate it rather than silently testing a truncation of it.
            pairs.extend(itertools.combinations(cols[:3], 2))

    # De-duplicate while preserving registration order.
    seen, unique = set(), []
    for a, b in pairs:
        key = frozenset((a, b))
        if key not in seen:
            seen.add(key)
            unique.append((a, b))

    return unique, {
        "proposed": len(ledger.hypotheses),
        "usable_pairs": len(unique),
        "tokens": ledger.total_tokens_used,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--nullset", type=int, default=25)
    ap.add_argument("--planted", type=int, default=25)
    ap.add_argument("--seed0", type=int, default=0)
    ap.add_argument("--out", type=str, default="eval/results")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    started = time.time()
    results, failures = [], []

    suites = [
        ("NULLSET", build_suite("NULLSET", args.nullset, seed0=args.seed0)),
        ("PLANTED", build_suite("PLANTED", args.planted, seed0=args.seed0,
                                effect_sizes=[0.2, 0.35, 0.5, 0.8])),
    ]

    for suite_name, tables in suites:
        for i, table in enumerate(tables, 1):
            try:
                registry, meta = propose_registry(table)
                if not registry:
                    failures.append({"table": table.name, "reason": "empty registry"})
                    continue

                # Coverage: of the relationships that genuinely exist, how many
                # did the proposer even put in the registry? This separates two
                # very different failures — never looking, versus looking and
                # not seeing. Without it, low power is uninterpretable.
                registered = {frozenset(p) for p in registry}
                covered = sum(1 for t in table.truth if t in registered)
                meta["truth_covered"] = covered
                meta["truth_total"] = len(table.truth)
                meta["coverage"] = covered / len(table.truth) if table.truth else None

                results.extend(evaluate_registry_arms(table, registry, meta))
            except Exception as e:
                failures.append({"table": table.name, "reason": str(e)[:200]})

            elapsed = time.time() - started
            print(f"  {suite_name}: {i}/{len(tables)}  ({elapsed:.0f}s, "
                  f"{len(failures)} failed)", flush=True)

    raw = [asdict(r) for r in results]
    for r in raw:
        r["claimed_pairs"] = [list(p) for p in r["claimed_pairs"]]

    with open(os.path.join(args.out, "registry_raw.json"), "w") as f:
        json.dump({"results": raw, "failures": failures}, f, indent=1, default=str)

    if results:
        summary = aggregate(results)
        summary.to_csv(os.path.join(args.out, "registry_summary.csv"), index=False)
        pd.set_option("display.width", 200, "display.max_columns", 30)
        print(f"\n{len(results)} arm-results, {len(failures)} failures, "
              f"{time.time() - started:.0f}s\n")
        print(summary.to_string(index=False))
    else:
        print("no results — every table failed")
    if failures:
        print(f"\nfailures ({len(failures)}):")
        for f_ in failures[:8]:
            print(f"  {f_['table']}: {f_['reason'][:110]}")


if __name__ == "__main__":
    main()
