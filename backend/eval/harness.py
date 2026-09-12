"""
The evaluation harness.

Every arm below runs the SAME test-selection code — `a5_statistician`'s own
`_select_and_run_test`. That is deliberate and it is what makes the comparison
mean anything: the arms differ only in which hypotheses enter the family and
whether the family is corrected, never in how a test is chosen or computed. A
baseline built on a separate implementation would confound the discipline
mechanisms with implementation differences, and the result would say nothing.

THE ARMS

  exhaustive_uncorrected
      Test every column pair, claim every p < 0.05. This is what an agent with
      code execution and no discipline does, and it is the behaviour the paper
      argues is the problem. Needs no model, so it runs on many tables.

  exhaustive_bh
      Every column pair, Benjamini-Hochberg across all of them. Isolates the
      contribution of CORRECTION ALONE, holding the candidate set fixed.

  registry_uncorrected
      Only the hypotheses the proposer registered, claim every p < 0.05.
      Isolates the contribution of a SMALLER FAMILY without correction.

  registry_bh   ← this is Ledger
      The registered hypotheses, frozen, corrected once across the family.

Comparing the four separates two mechanisms that are easy to conflate: does
Ledger control false discovery because it corrects, or merely because a
proposer tests fewer things? The middle two arms answer that.
"""
from __future__ import annotations

import itertools
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from statsmodels.stats.multitest import multipletests

from agents.a5_statistician import _select_and_run_test
from core.ledger import HypothesisEntry
from eval.generators import Table

logger = logging.getLogger(__name__)

ALPHA = 0.05


@dataclass
class TestOutcome:
    """One executed test on one column pair."""
    pair: frozenset
    cols: Tuple[str, str]
    test_name: str
    p_value: float
    effect: Optional[float]
    ok: bool
    error: Optional[str] = None


@dataclass
class ArmResult:
    """What one arm claimed on one table, scored against ground truth."""
    arm: str
    table: str
    suite: str
    n_candidates: int          # size of the family this arm considered
    n_tested: int              # tests that actually executed
    n_claimed: int             # findings reported
    true_positives: int
    false_positives: int
    n_true: int                # planted relationships in the table
    claimed_pairs: List[Tuple[str, str]] = field(default_factory=list)
    effect_errors: List[float] = field(default_factory=list)
    meta: Dict = field(default_factory=dict)

    @property
    def false_discovery_proportion(self) -> float:
        """FP / claimed. Zero claims is zero false discoveries, by definition."""
        return self.false_positives / self.n_claimed if self.n_claimed else 0.0

    @property
    def power(self) -> float:
        return self.true_positives / self.n_true if self.n_true else float("nan")


def _pair_entry(a: str, b: str) -> HypothesisEntry:
    """A minimal registry entry so A5's selector can be called on a raw pair."""
    return HypothesisEntry(
        id=f"P_{a}__{b}",
        statement=f"{a} is associated with {b}",
        columns_involved=[a, b],
    )


def run_tests(df: pd.DataFrame, pairs: Sequence[Tuple[str, str]]) -> List[TestOutcome]:
    """Execute one test per pair using the production selector."""
    outcomes: List[TestOutcome] = []
    for a, b in pairs:
        try:
            name, stat, p, effect, _label, _assumptions = _select_and_run_test(_pair_entry(a, b), df)
            if p is None or not np.isfinite(p):
                raise ValueError(f"non-finite p-value: {p}")
            outcomes.append(TestOutcome(
                pair=frozenset((a, b)), cols=(a, b), test_name=name,
                p_value=float(p), effect=None if effect is None else float(effect), ok=True,
            ))
        except Exception as e:
            outcomes.append(TestOutcome(
                pair=frozenset((a, b)), cols=(a, b), test_name="n/a",
                p_value=1.0, effect=None, ok=False, error=str(e)[:160],
            ))
    return outcomes


def all_pairs(df: pd.DataFrame, max_pairs: int = 400) -> List[Tuple[str, str]]:
    """
    Every unordered column pair — the candidate set of an agent that searches
    without restraint. Capped only so a very wide table cannot dominate runtime;
    the cap is recorded so it can be reported.
    """
    cols = list(df.columns)
    pairs = list(itertools.combinations(cols, 2))
    return pairs[:max_pairs]


def score(
    arm: str,
    table: Table,
    outcomes: List[TestOutcome],
    claimed: List[TestOutcome],
    n_candidates: int,
    meta: Optional[Dict] = None,
) -> ArmResult:
    """Score an arm's claims against the table's ground truth."""
    tp = sum(1 for o in claimed if o.pair in table.truth)
    fp = len(claimed) - tp

    effect_errors: List[float] = []
    for o in claimed:
        if o.pair in table.effects and o.effect is not None:
            truth_effect = abs(table.effects[o.pair])
            effect_errors.append(abs(abs(o.effect) - truth_effect))

    return ArmResult(
        arm=arm, table=table.name, suite=table.suite,
        n_candidates=n_candidates,
        n_tested=sum(1 for o in outcomes if o.ok),
        n_claimed=len(claimed),
        true_positives=tp, false_positives=fp, n_true=table.n_true,
        claimed_pairs=[o.cols for o in claimed],
        effect_errors=effect_errors,
        meta={**(meta or {}), **table.meta},
    )


def apply_bh(outcomes: List[TestOutcome], alpha: float = ALPHA) -> List[TestOutcome]:
    """
    Benjamini-Hochberg across the whole family, once.

    Failed tests stay in the family with p = 1.0 rather than being dropped.
    Removing them would shrink m and make the threshold more permissive for
    everything else, which is the exact accounting error the architecture is
    built to prevent — so the harness must not commit it either.
    """
    usable = [o for o in outcomes if o.ok]
    if not usable:
        return []
    p_values = [o.p_value for o in outcomes]          # includes failures at 1.0
    reject, _adj, _, _ = multipletests(p_values, alpha=alpha, method="fdr_bh")
    return [o for o, r in zip(outcomes, reject) if r and o.ok]


def uncorrected(outcomes: List[TestOutcome], alpha: float = ALPHA) -> List[TestOutcome]:
    """Claim every test that clears alpha on its own. No accounting for m."""
    return [o for o in outcomes if o.ok and o.p_value < alpha]


def evaluate_deterministic_arms(table: Table, max_pairs: int = 400) -> List[ArmResult]:
    """
    The two arms that need no model: exhaustive search with and without
    correction. Cheap enough to run on a large suite, which is what makes a
    meaningful sample size affordable.
    """
    pairs = all_pairs(table.df, max_pairs=max_pairs)
    outcomes = run_tests(table.df, pairs)

    return [
        score("exhaustive_uncorrected", table, outcomes, uncorrected(outcomes), len(pairs)),
        score("exhaustive_bh", table, outcomes, apply_bh(outcomes), len(pairs)),
    ]


def evaluate_registry_arms(
    table: Table,
    registry: List[Tuple[str, str]],
    registry_meta: Optional[Dict] = None,
) -> List[ArmResult]:
    """
    The two arms that use a proposer's registry: the same candidate set, with
    and without correction. `registry` is whatever the proposer registered,
    already frozen.
    """
    registry = [(a, b) for a, b in registry if a in table.df.columns and b in table.df.columns]
    if not registry:
        return []
    outcomes = run_tests(table.df, registry)
    meta = {**(registry_meta or {}), "registry_size": len(registry)}

    return [
        score("registry_uncorrected", table, outcomes, uncorrected(outcomes), len(registry), meta),
        score("registry_bh", table, outcomes, apply_bh(outcomes), len(registry), meta),
    ]


def aggregate(results: List[ArmResult]) -> pd.DataFrame:
    """
    Per-arm summary.

    `mean_fdp` averages the false discovery proportion over tables, which is the
    quantity BH actually controls in expectation. `any_false_discovery` is the
    number a practitioner cares about: on what fraction of null tables did the
    system claim anything at all?
    """
    rows = []
    by_arm: Dict[str, List[ArmResult]] = {}
    for r in results:
        by_arm.setdefault((r.arm, r.suite), []).append(r)

    for (arm, suite), rs in sorted(by_arm.items()):
        n = len(rs)
        claims = [r.n_claimed for r in rs]
        fps = [r.false_positives for r in rs]
        errs = [e for r in rs for e in r.effect_errors]
        powers = [r.power for r in rs if r.n_true > 0]

        rows.append({
            "arm": arm,
            "suite": suite,
            "tables": n,
            "mean_claims": float(np.mean(claims)),
            "median_claims": float(np.median(claims)),
            "mean_false_positives": float(np.mean(fps)),
            "total_false_positives": int(np.sum(fps)),
            "any_false_discovery_rate": float(np.mean([1.0 if f > 0 else 0.0 for f in fps])),
            "mean_fdp": float(np.mean([r.false_discovery_proportion for r in rs])),
            "mean_power": float(np.mean(powers)) if powers else float("nan"),
            "mean_candidates": float(np.mean([r.n_candidates for r in rs])),
            "mean_effect_abs_error": float(np.mean(errs)) if errs else float("nan"),
        })
    return pd.DataFrame(rows)
