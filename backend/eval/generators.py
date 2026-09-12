"""
NULLSET and PLANTED — synthetic tables with ground truth known by construction.

The point of NULLSET is stated in the synopsis: give a system a table with
nothing in it and count what it claims to find. The correct answer is zero, and
it is zero because of how the table was built rather than because somebody
judged it so.

Two things make these tables harder than naive noise, and both matter for the
result to mean anything:

1. Realistic surface. Columns carry plausible names, mixed dtypes, skewed and
   heavy-tailed numerics, unbalanced categoricals, and missingness. A table that
   looks synthetic invites the objection that the system only succeeded because
   the data was obviously fake.

2. Nuisance structure, optionally. Real data contains genuine but uninteresting
   relationships — encoding artefacts, collection effects. `nuisance=True` adds
   deterministic couplings (a derived column, an id correlated with time) that
   are real but trivial. These are the honest hard case: a system that reports
   them is not wrong exactly, but it is not useful either.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


NUMERIC_NAMES = [
    "tenure_months", "monthly_charges", "total_spend", "session_minutes",
    "age_years", "num_orders", "latency_ms", "credit_score", "bmi",
    "visit_count", "unit_price", "days_since_signup", "response_time",
    "systolic_bp", "score_q1", "score_q2", "hours_logged", "balance",
]
CATEGORICAL_NAMES = [
    "region", "plan_tier", "contract_type", "device", "channel", "segment",
    "status", "payment_method", "browser", "cohort", "department", "grade",
]
BINARY_NAMES = [
    "churned", "paperless", "is_active", "opted_in", "returned",
    "flagged", "converted", "has_support_case",
]


@dataclass
class Table:
    """A generated table plus everything needed to score a system against it."""
    df: pd.DataFrame
    name: str
    suite: str                                   # "NULLSET" | "PLANTED"
    # Column pairs that carry a real relationship, as frozensets so order and
    # direction never matter when scoring.
    truth: List[frozenset] = field(default_factory=list)
    # Planted effect magnitudes, keyed the same way, for estimation error.
    effects: Dict[frozenset, float] = field(default_factory=dict)
    meta: Dict = field(default_factory=dict)

    @property
    def n_true(self) -> int:
        return len(self.truth)

    def is_true_pair(self, a: str, b: str) -> bool:
        return frozenset((a, b)) in self.truth


def _numeric_column(rng: np.random.Generator, n: int) -> np.ndarray:
    """A numeric column with a shape drawn from the kinds real data has."""
    kind = rng.choice(["normal", "lognormal", "gamma", "uniform", "bimodal", "count"])
    if kind == "normal":
        return rng.normal(rng.uniform(10, 200), rng.uniform(2, 40), n)
    if kind == "lognormal":
        return rng.lognormal(rng.uniform(1, 4), rng.uniform(0.3, 1.1), n)
    if kind == "gamma":
        return rng.gamma(rng.uniform(1.2, 6), rng.uniform(2, 12), n)
    if kind == "uniform":
        lo = rng.uniform(0, 50)
        return rng.uniform(lo, lo + rng.uniform(10, 200), n)
    if kind == "bimodal":
        a = rng.normal(20, 5, n)
        b = rng.normal(70, 8, n)
        pick = rng.random(n) < 0.4
        return np.where(pick, a, b)
    return rng.poisson(rng.uniform(0.8, 6), n).astype(float)


def _categorical_column(rng: np.random.Generator, n: int, k: Optional[int] = None) -> np.ndarray:
    """An unbalanced categorical — real categories are rarely uniform."""
    k = k or int(rng.integers(2, 6))
    levels = [f"L{i+1}" for i in range(k)]
    weights = rng.dirichlet(np.ones(k) * rng.uniform(0.6, 3.0))
    return rng.choice(levels, n, p=weights)


def _apply_missingness(rng: np.random.Generator, df: pd.DataFrame, rate: float) -> None:
    """Missing completely at random, so it cannot induce a relationship."""
    if rate <= 0:
        return
    for col in df.columns:
        if rng.random() < 0.5:
            idx = rng.choice(len(df), int(len(df) * rate * rng.uniform(0.3, 1.0)), replace=False)
            df.loc[df.index[idx], col] = np.nan


def make_null_table(
    seed: int,
    n_rows: Optional[int] = None,
    n_cols: Optional[int] = None,
    nuisance: bool = False,
) -> Table:
    """
    A table with no real relationships.

    Every column is drawn independently, so the correct number of findings is
    exactly zero. With `nuisance=True` a small number of trivially-real
    couplings are added and recorded in `truth`, so a system is not penalised
    for finding them — they are there to test whether the reported set is
    dominated by the uninteresting.
    """
    rng = np.random.default_rng(seed)
    n_rows = n_rows or int(rng.integers(300, 2500))
    n_cols = n_cols or int(rng.integers(6, 14))

    n_num = max(2, int(n_cols * rng.uniform(0.4, 0.7)))
    n_cat = max(1, int((n_cols - n_num) * rng.uniform(0.5, 1.0)))
    n_bin = max(1, n_cols - n_num - n_cat)

    num_names = list(rng.choice(NUMERIC_NAMES, min(n_num, len(NUMERIC_NAMES)), replace=False))
    cat_names = list(rng.choice(CATEGORICAL_NAMES, min(n_cat, len(CATEGORICAL_NAMES)), replace=False))
    bin_names = list(rng.choice(BINARY_NAMES, min(n_bin, len(BINARY_NAMES)), replace=False))

    data = {}
    for name in num_names:
        data[name] = _numeric_column(rng, n_rows)
    for name in cat_names:
        data[name] = _categorical_column(rng, n_rows)
    for name in bin_names:
        data[name] = rng.choice(["Yes", "No"], n_rows, p=rng.dirichlet([2.0, 2.0]))

    df = pd.DataFrame(data)
    truth: List[frozenset] = []

    if nuisance and len(num_names) >= 2:
        # A derived column: real, deterministic, and completely uninteresting.
        src = num_names[0]
        derived = f"{src}_scaled"
        df[derived] = df[src] * 1.6 + rng.normal(0, 0.01, n_rows)
        truth.append(frozenset((src, derived)))

    _apply_missingness(rng, df, rate=float(rng.uniform(0.0, 0.12)))

    return Table(
        df=df,
        name=f"null_{seed:04d}",
        suite="NULLSET",
        truth=truth,
        meta={"seed": seed, "n_rows": n_rows, "n_cols": df.shape[1], "nuisance": nuisance},
    )


def make_planted_table(
    seed: int,
    n_effects: Optional[int] = None,
    effect_size: Optional[float] = None,
    n_rows: Optional[int] = None,
    n_cols: Optional[int] = None,
) -> Table:
    """
    A table with a known number of genuine relationships at a controlled
    magnitude, buried among independent noise columns.

    Effects are planted in three forms so that test selection is exercised
    rather than a single code path:
      - numeric ~ binary   (a mean shift; Welch / Mann-Whitney territory)
      - numeric ~ numeric  (a linear association; Pearson / Spearman)
      - numeric ~ categorical with k>2 levels (ANOVA / Kruskal-Wallis)
    """
    rng = np.random.default_rng(seed + 100_000)
    n_rows = n_rows or int(rng.integers(400, 2500))
    n_cols = n_cols or int(rng.integers(8, 14))
    n_effects = n_effects or int(rng.integers(2, 5))
    # Cohen's d, swept by the caller to trace a power curve.
    d = effect_size if effect_size is not None else float(rng.choice([0.2, 0.35, 0.5, 0.8]))

    base = make_null_table(seed + 500_000, n_rows=n_rows, n_cols=n_cols)
    df = base.df.copy()

    num_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    cat_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]

    truth: List[frozenset] = []
    effects: Dict[frozenset, float] = {}
    planted = 0
    attempts = 0

    while planted < n_effects and attempts < n_effects * 6:
        attempts += 1
        form = rng.choice(["shift", "linear", "kgroup"])

        if form == "shift" and num_cols and cat_cols:
            y = str(rng.choice(num_cols))
            g = str(rng.choice(cat_cols))
            pair = frozenset((y, g))
            if pair in truth:
                continue
            levels = pd.Series(df[g]).dropna().unique()
            if len(levels) < 2:
                continue
            # Shift one level by d standard deviations.
            sd = float(np.nanstd(df[y])) or 1.0
            target = levels[0]
            mask = (df[g] == target).to_numpy()
            df.loc[mask, y] = df.loc[mask, y] + d * sd
            truth.append(pair)
            effects[pair] = d
            planted += 1

        elif form == "linear" and len(num_cols) >= 2:
            x, y = rng.choice(num_cols, 2, replace=False)
            pair = frozenset((str(x), str(y)))
            if pair in truth:
                continue
            # Pearson r implied by Cohen's d: r = d / sqrt(d^2 + 4).
            r = d / np.sqrt(d ** 2 + 4)
            xs = df[str(x)].to_numpy(dtype=float)
            xz = (xs - np.nanmean(xs)) / (np.nanstd(xs) or 1.0)
            ys = df[str(y)].to_numpy(dtype=float)
            yz = (ys - np.nanmean(ys)) / (np.nanstd(ys) or 1.0)
            mixed = r * xz + np.sqrt(max(1 - r ** 2, 0.0)) * yz
            df[str(y)] = mixed * (np.nanstd(ys) or 1.0) + np.nanmean(ys)
            truth.append(pair)
            effects[pair] = float(r)
            planted += 1

        elif form == "kgroup" and num_cols and cat_cols:
            y = str(rng.choice(num_cols))
            g = str(rng.choice(cat_cols))
            pair = frozenset((y, g))
            if pair in truth:
                continue
            levels = list(pd.Series(df[g]).dropna().unique())
            if len(levels) < 3:
                continue
            sd = float(np.nanstd(df[y])) or 1.0
            # Spread group means evenly across a d-sized range.
            offsets = np.linspace(-d / 2, d / 2, len(levels)) * sd
            for lvl, off in zip(levels, offsets):
                mask = (df[g] == lvl).to_numpy()
                df.loc[mask, y] = df.loc[mask, y] + off
            truth.append(pair)
            effects[pair] = d
            planted += 1

    return Table(
        df=df,
        name=f"planted_{seed:04d}_d{d}",
        suite="PLANTED",
        truth=truth,
        effects=effects,
        meta={
            "seed": seed, "n_rows": n_rows, "n_cols": df.shape[1],
            "effect_size": d, "n_planted": len(truth),
        },
    )


def build_suite(
    suite: str,
    n_tables: int,
    seed0: int = 0,
    effect_sizes: Optional[List[float]] = None,
    nuisance: bool = False,
) -> List[Table]:
    """Build a suite. PLANTED sweeps effect_sizes evenly across the tables."""
    if suite.upper() == "NULLSET":
        return [make_null_table(seed0 + i, nuisance=nuisance) for i in range(n_tables)]

    sizes = effect_sizes or [0.2, 0.35, 0.5, 0.8]
    return [
        make_planted_table(seed0 + i, effect_size=sizes[i % len(sizes)])
        for i in range(n_tables)
    ]
