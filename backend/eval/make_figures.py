
"""
Figures for the paper, generated from the raw results — never hand-drawn.

Every number rendered here is read from the JSON the harness wrote, so a figure
cannot drift from the experiment that produced it. Re-run this after any change
to the harness and the paper's figures update with it.
"""
from __future__ import annotations

import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Print-safe and colourblind-safe. The subject carries the hue; baselines stay grey.
INK, SUBJECT, BASELINE, WARN = "#1a1a1a", "#0d7a6f", "#9aa3ab", "#b45309"

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "DejaVu Serif"],
    "font.size": 8,
    "axes.linewidth": 0.6,
    "axes.edgecolor": "#555555",
    "axes.labelsize": 8,
    "xtick.labelsize": 7.5,
    "ytick.labelsize": 7.5,
    "legend.fontsize": 7.5,
    "legend.frameon": False,
    "figure.dpi": 200,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.02,
})

ARM_LABEL = {
    "exhaustive_uncorrected": "Exhaustive, uncorrected",
    "exhaustive_bh": "Exhaustive, BH-corrected",
    "registry_uncorrected": "Registry, uncorrected",
    "registry_bh": "Ledger (registry + BH)",
}


def load(results_dir):
    frames = []
    det = os.path.join(results_dir, "deterministic_raw.json")
    if os.path.exists(det):
        frames.append(pd.DataFrame(json.load(open(det))))
    reg = os.path.join(results_dir, "registry_raw.json")
    if os.path.exists(reg):
        payload = json.load(open(reg))
        rows = payload["results"] if isinstance(payload, dict) else payload
        if rows:
            frames.append(pd.DataFrame(rows))
    if not frames:
        raise SystemExit("no results found - run the harness first")
    df = pd.concat(frames, ignore_index=True)
    df["fdp"] = df.apply(
        lambda r: r["false_positives"] / r["n_claimed"] if r["n_claimed"] else 0.0, axis=1)
    df["power"] = df.apply(
        lambda r: r["true_positives"] / r["n_true"] if r["n_true"] else np.nan, axis=1)
    return df


def fig_null(df, out):
    """The headline: findings claimed on tables that contain nothing."""
    null = df[df["suite"] == "NULLSET"]
    arms = [a for a in ARM_LABEL if a in set(null["arm"])]
    if not arms:
        return

    means = [null[null["arm"] == a]["n_claimed"].mean() for a in arms]
    # Standard error over tables. A mean with no spread invites exactly the
    # overclaiming this paper is about.
    sems = [null[null["arm"] == a]["n_claimed"].sem() for a in arms]
    anyfd = [(null[null["arm"] == a]["false_positives"] > 0).mean() * 100 for a in arms]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.6, 2.5))
    colors = [SUBJECT if a.endswith("_bh") else BASELINE for a in arms]
    x = np.arange(len(arms))

    top = max(means) * 1.28                      # headroom so labels never clip
    ax1.bar(x, means, yerr=sems, capsize=2.5, color=colors, width=0.6,
            error_kw={"elinewidth": 0.7, "capthick": 0.7})
    ax1.axhline(0, color=INK, lw=1.0)
    ax1.set_ylim(0, top)
    ax1.set_xticks(x)
    ax1.set_xticklabels([ARM_LABEL[a].replace(", ", ",\n") for a in arms], fontsize=7)
    ax1.set_ylabel("Findings claimed per table")
    ax1.set_title("(a) Mean findings on null tables", fontsize=8, loc="left")
    # Place each value above its own error bar, not above the bar, so the two
    # never collide on the tall arm.
    for xi, m, se in zip(x, means, sems):
        ax1.text(xi, m + (se if np.isfinite(se) else 0) + top * 0.045,
                 f"{m:.2f}", ha="center", fontsize=7.5)
    ax1.text(0.5, 0.93, "ground truth = 0 findings", transform=ax1.transAxes,
             fontsize=7, color=INK, ha="center", style="italic")

    ax2.bar(x, anyfd, color=colors, width=0.6)
    ax2.set_xticks(x)
    ax2.set_xticklabels([ARM_LABEL[a].replace(", ", ",\n") for a in arms], fontsize=7)
    ax2.set_ylabel("Tables with $\\geq$1 false finding (%)")
    ax2.set_ylim(0, 108)
    ax2.set_title("(b) Fraction of null tables contaminated", fontsize=8, loc="left")
    for xi, v in zip(x, anyfd):
        ax2.text(xi, v + 2.5, f"{v:.1f}%", ha="center", fontsize=7.5)

    for ax in (ax1, ax2):
        ax.spines[["top", "right"]].set_visible(False)
        ax.tick_params(length=2.5)

    fig.savefig(os.path.join(out, "fig1_nullset.pdf"))
    fig.savefig(os.path.join(out, "fig1_nullset.png"))
    plt.close(fig)


def fig_power(df, out):
    """What discipline costs in sensitivity, and what it buys."""
    pl = df[(df["suite"] == "PLANTED") & (df["n_true"] > 0)].copy()
    pl["effect_size"] = pl["meta"].apply(
        lambda m: (m or {}).get("effect_size") if isinstance(m, dict) else None)
    pl = pl.dropna(subset=["effect_size"])
    if pl.empty:
        return

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.6, 2.5))
    arms = [a for a in ARM_LABEL if a in set(pl["arm"])]

    for a in arms:
        sub = pl[pl["arm"] == a].groupby("effect_size").agg(
            power=("power", "mean"), fdp=("fdp", "mean"),
            n=("power", "size"), sem=("power", "sem")).reset_index()
        style = dict(
            color=SUBJECT if a.endswith("_bh") else BASELINE,
            marker="o" if a.endswith("_bh") else "s",
            ms=3.5, lw=1.4, label=ARM_LABEL[a],
            ls="-" if a.startswith("exhaustive") else "--",
        )
        ax1.errorbar(sub["effect_size"], sub["power"], yerr=sub["sem"],
                     capsize=2, elinewidth=0.7, **style)
        ax2.plot(sub["effect_size"], sub["fdp"], **style)

    ax1.set_xlabel("Planted effect size (Cohen's $d$)")
    ax1.set_ylabel("Power (recall of planted effects)")
    ax1.set_ylim(0, 1.05)
    ax1.set_title("(a) Sensitivity", fontsize=8, loc="left")
    ax1.legend(loc="lower right")

    ax2.axhline(0.05, color=WARN, lw=0.9, ls=":", label="nominal $q = 0.05$")
    ax2.set_xlabel("Planted effect size (Cohen's $d$)")
    ax2.set_ylabel("False discovery proportion")
    ax2.set_ylim(0, 0.55)
    ax2.set_title("(b) Cost of an unclaimed family", fontsize=8, loc="left")
    ax2.legend(loc="center right")

    for ax in (ax1, ax2):
        ax.spines[["top", "right"]].set_visible(False)
        ax.tick_params(length=2.5)
        ax.grid(axis="y", lw=0.4, color="#e8e8e8")
        ax.set_axisbelow(True)

    fig.savefig(os.path.join(out, "fig2_power.pdf"))
    fig.savefig(os.path.join(out, "fig2_power.png"))
    plt.close(fig)


def fig_family(df, out):
    """
    Where does the control come from - a smaller candidate family, or
    correcting across it? Claims against family size separates the two.
    """
    null = df[df["suite"] == "NULLSET"]
    arms = [a for a in ARM_LABEL if a in set(null["arm"])]
    if len(arms) < 3:
        return

    fig, ax = plt.subplots(figsize=(3.3, 2.5))
    for a in arms:
        sub = null[null["arm"] == a]
        ax.scatter(sub["n_candidates"], sub["n_claimed"],
                   s=11, alpha=0.55,
                   color=SUBJECT if a.endswith("_bh") else BASELINE,
                   marker="o" if a.startswith("registry") else "^",
                   label=ARM_LABEL[a], edgecolors="none")
    ax.set_xlabel("Hypotheses in the family ($m$)")
    ax.set_ylabel("False findings claimed")
    ax.set_title("Null tables: family size vs. claims", fontsize=8, loc="left")
    ax.legend(fontsize=6.5, loc="upper left")
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(lw=0.4, color="#e8e8e8")
    ax.set_axisbelow(True)
    fig.savefig(os.path.join(out, "fig3_family.pdf"))
    fig.savefig(os.path.join(out, "fig3_family.png"))
    plt.close(fig)


def main():
    results = sys.argv[1] if len(sys.argv) > 1 else "eval/results"
    out = sys.argv[2] if len(sys.argv) > 2 else "../paper/figures"
    os.makedirs(out, exist_ok=True)
    df = load(results)
    fig_null(df, out)
    fig_power(df, out)
    fig_family(df, out)
    made = sorted(f for f in os.listdir(out) if f.endswith((".pdf", ".png")))
    print(f"wrote {len(made)} files to {out}:")
    for f in made:
        print("  ", f)


if __name__ == "__main__":
    main()
