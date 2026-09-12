"""
Run the evaluation and write raw per-table results.

Deterministic arms only — these need no model, so the suite can be large enough
for the numbers to mean something. The model-backed arms are run separately by
run_registry_eval.py on a subset, because each table there costs an LLM call.

Usage:
    python -m eval.run_eval --nullset 200 --planted 240 --out eval/results
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import asdict

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The provider credentials live in backend/.env, which only main.py loaded.
# Running the harness as a module bypasses that, so load it here too.
from dotenv import load_dotenv  # noqa: E402
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from eval.generators import build_suite                      # noqa: E402
from eval.harness import evaluate_deterministic_arms, aggregate  # noqa: E402

logging.disable(logging.CRITICAL)   # agent logging is noise here


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--nullset", type=int, default=200)
    ap.add_argument("--planted", type=int, default=240)
    ap.add_argument("--nuisance", type=int, default=0,
                    help="NULLSET tables that also carry trivially-real structure")
    ap.add_argument("--seed0", type=int, default=0)
    ap.add_argument("--out", type=str, default="eval/results")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    started = time.time()
    results = []

    suites = [
        ("NULLSET", build_suite("NULLSET", args.nullset, seed0=args.seed0)),
        ("PLANTED", build_suite("PLANTED", args.planted, seed0=args.seed0,
                                effect_sizes=[0.2, 0.35, 0.5, 0.8])),
    ]
    if args.nuisance:
        # Reported as its own suite. These tables contain one genuinely-real but
        # trivially-uninteresting relationship, so pooling them with pure nulls
        # would understate the false-positive count on the pure nulls and make
        # the headline number look better than it is.
        nuis = build_suite("NULLSET", args.nuisance, seed0=args.seed0 + 900_000, nuisance=True)
        for t in nuis:
            t.suite = "NULLSET_NUISANCE"
        suites.append(("NULLSET_NUISANCE", nuis))

    for suite_name, tables in suites:
        for i, table in enumerate(tables, 1):
            results.extend(evaluate_deterministic_arms(table))
            if i % 25 == 0 or i == len(tables):
                print(f"  {suite_name}: {i}/{len(tables)} tables "
                      f"({time.time() - started:.0f}s)", flush=True)

    raw = [asdict(r) for r in results]
    for r in raw:                      # frozensets are not JSON-serialisable
        r["claimed_pairs"] = [list(p) for p in r["claimed_pairs"]]

    raw_path = os.path.join(args.out, "deterministic_raw.json")
    with open(raw_path, "w") as f:
        json.dump(raw, f, indent=1, default=str)

    summary = aggregate(results)
    summary.to_csv(os.path.join(args.out, "deterministic_summary.csv"), index=False)

    # Power as a function of planted effect size — the curve that says what
    # discipline costs in sensitivity, which is the trade-off the whole design
    # rests on and the thing a reviewer will ask for first.
    curve_rows = []
    for r in results:
        if r.suite != "PLANTED" or not r.n_true:
            continue
        curve_rows.append({
            "arm": r.arm,
            "effect_size": r.meta.get("effect_size"),
            "power": r.power,
            "fdp": r.false_discovery_proportion,
            "claims": r.n_claimed,
            "false_positives": r.false_positives,
        })
    if curve_rows:
        curve = (pd.DataFrame(curve_rows)
                 .groupby(["arm", "effect_size"])
                 .agg(tables=("power", "size"),
                      mean_power=("power", "mean"),
                      mean_fdp=("fdp", "mean"),
                      mean_claims=("claims", "mean"),
                      mean_false_positives=("false_positives", "mean"))
                 .reset_index())
        curve.to_csv(os.path.join(args.out, "power_curve.csv"), index=False)
        print("\nPower by planted effect size")
        print(curve.to_string(index=False))

    pd.set_option("display.width", 200, "display.max_columns", 30)
    print(f"\n{len(results)} arm-results over {time.time() - started:.0f}s\n")
    print(summary.to_string(index=False))
    print(f"\nwrote {raw_path}")


if __name__ == "__main__":
    main()
