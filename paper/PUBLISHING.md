# Getting this published

Two research agents were run to produce this: a literature survey looking for
work that would scoop the novelty claim, and a venue survey. What follows is
their findings filtered through what the evaluation actually produced.

Deadlines were verified on 2026-09-12. Re-check before relying on any of them.

---

## 1. What we can honestly claim

The evaluation gives two results, and the second is the more interesting one.

**Correction works, and is nearly free above d = 0.5.** On 200 null tables an
exhaustive uncorrected analyst contaminates 81.0% of them; one session-level BH
correction takes that to 2.5%, costing six points of power overall and under one
point at d >= 0.5.

**Pre-registration through a blind proposer is expensive, and we know exactly
why.** Substituting the model-chosen registry drives false discovery to zero on
null tables but drops power to 0.123. Power *conditional on a relationship being
registered* is 0.923, while the proposer registers only 14.1% of the
relationships that exist. The statistics are fine; the coverage is not.

That second result is the paper's strongest asset, not its weakness. It is a
measured, surprising, mechanistic finding that nobody has published, and it
yields a concrete research agenda (budget sweeps, sample splitting). Papers that
report only their flattering numbers are the ones reviewers distrust.

**Do not claim** to have invented FDR control or pre-registration. BH is from
1995; pre-registration is older. The claim is the systems engineering that makes
them binding on an agent, plus the evaluation regime.

## 2. Scoop risk: MEDIUM

Nobody has published the full combination, but the field is closing in.

- **Fisher-R1 + P-Bench** (arXiv:2608.07437, Miao, Mu, Chen, Zou — Aug 2026).
  *Verified: abstract read directly.* Trains an agent by RL for reliable
  hypothesis testing; 425 tasks. **Single test per task, and the abstract never
  mentions multiple comparisons or FDR.** This is both the closest competitor
  and the clearest statement of our gap. Cite it prominently and position
  against it: per-test rigour is necessary but not sufficient for session-level
  validity.
- **Many AI Analysts, One Dataset** (arXiv:2602.18710, Bertran, Fogliato, Wu —
  Feb 2026). *Verified.* Shows autonomous LLM analysts reproduce human
  many-analyst dispersion and that it is steerable by model/persona. Use as
  motivation: the disease is documented and published; we propose a cure.
- **Sanity Checks for Agentic Data Science** (arXiv:2604.11003, Rewolinski et
  al., incl. Bin Yu — Apr 2026). *Verified.* Perturbation/stability screening
  for noise-fitting. Complementary axis, not competing — cite and differentiate
  explicitly or a reviewer who knows the PCS line of work will do it for you.
- **BLADE** (arXiv:2408.09667, Gu et al., EMNLP 2024). *Verified.* Documents
  that experts disagree on the right analysis. This bounds what we can claim for
  deterministic adjudication — "reproducible", not "uniquely correct". The paper
  already concedes this in Threats to Validity.

Practical implication: **submit before Q1 2027.** The gap Fisher-R1 leaves open
is visible to a well-resourced group.

## 3. Where to send it

Recommended framing: a **systems/tool paper whose evaluation section is the
protocol contribution**, with the benchmark released separately. Not a full
research paper (overclaims), not a position paper (wastes the artifact).

| Venue | Deadline (verified 2026-09-12) | Fit |
|---|---|---|
| **ICSE 2027 Tool Demos** | **23 Oct 2026** | Best near-term shot. 4 pages + video. A video showing a null table producing zero findings beside a naive pipeline hallucinating on the same table is the whole argument in 90 seconds. |
| **VLDB Scalable Data Science** (short) | Rolling, 1st of each month | 12 pages, single-blind. Realistic target once the registry arms are re-run at scale. |
| **TMLR** | Rolling | Reviews for correctness, not novelty or "importance" — unusually good fit for an honest negative-ish result. |
| **JOSS** | Rolling | Reviews the software itself. The repo is close to meeting the checklist already. |
| **NeurIPS Evaluations & Datasets** | ~May 2027 | The strongest conceptual fit for NULLSET/PLANTED, but wants 100+ tables and 3+ baselines. We have 480 tables and 4 arms — this is genuinely reachable by then. |
| **arXiv (cs.LG, cross-list cs.DB / stat.ME)** | Anytime | Do this early to timestamp the claim. **Note the barrier:** first-time submission to each category needs endorsement from someone with 5+ papers in *that exact* category. Ask your NSUT project guide early; it can take weeks. |

Ruled out: CIDR 2027 (deadline passed 4 Aug 2026), FSE/ASE 2026 (passed),
NeurIPS/ICML/ICLR main tracks (calibrated to industrial-scale studies).

## 4. What still needs doing

In priority order, and none of it needs a GPU.

1. **Re-run the registry arms at n >= 100 per suite.** The 14.1% coverage figure
   is the paper's most important number and currently rests on 30 tables. About
   an hour of model calls.
2. **Sweep the registration budget.** Have the proposer register 5/10/20/40
   hypotheses and plot coverage and power against it. This turns the tension we
   report into a dose-response curve and is the single most persuasive addition
   available.
3. **Second proposer model.** Coverage is plausibly model-dependent in a way
   correction is not; one more model tells you whether 14% is a property of the
   configuration or of the approach.
4. **Permuted real datasets.** Preserves marginal distributions while destroying
   relationships — answers the "synthetic nulls are too easy" objection directly.
5. **Zenodo DOI + Croissant metadata + a datasheet** for the benchmark release.
6. **Pick a licence** (MIT or Apache-2.0 for code, CC-BY-4.0 for the generated
   data) before submitting anywhere.

## 5. Reviewer objections to prepare for

- *"This is 1995 BH bolted onto an agent."* — Answer with §5.4: correction and
  pre-registration have very different cost profiles, and nobody had measured
  the second.
- *"Fisher-R1 already does LLM hypothesis testing."* — Per-test rigour, single
  test per task. Show that per-test correctness still accumulates false
  discoveries across a session.
- *"Deterministic selection can't handle ambiguity; BLADE shows experts
  disagree."* — Already conceded in Threats to Validity: the claim is
  reproducibility, not uniqueness.
- *"A system evaluated on nulls trivially wins by saying nothing."* — This is
  exactly why the power curve and the conditional-power decomposition are in the
  paper. Lead with them if pressed.
