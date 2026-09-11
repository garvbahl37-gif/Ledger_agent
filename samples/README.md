# Sample data

## telecom_churn.csv

1,400 rows, 9 columns. A PLANTED-style table in the sense of the synopsis:
two genuine relationships buried among noise columns, with ground truth known
because the data was generated rather than collected.

**The two real effects**

| Relationship | How it was planted |
|---|---|
| `tenure_months` × `churned` | Churned customers drawn from `Gamma(2.0, 9)`, retained from `Gamma(4.5, 9)` — a large, unambiguous shift |
| `monthly_charges` × `contract_type` | Means of 74 / 64 / 60 for month-to-month / one-year / two-year, σ = 18 |

**The noise**

`support_calls`, `satisfaction`, `region` and `paperless` are drawn
independently of everything else. Any finding involving only these columns is a
false positive. `satisfaction` also carries 60 missing values, so the pairwise
handling gets exercised.

**What a correct run looks like**

Both planted effects recovered, every noise relationship rejected. On the run
used to validate the pipeline:

```
UH02  SUPPORTED  churned × tenure_months        Mann-Whitney U   p=7.1e-102  effect -1.42 (large)
UH01  SUPPORTED  contract_type × monthly_charges One-way ANOVA   p=3.6e-25   effect  0.08 (small)
H01…H10  REJECTED — all noise, correctly not supported
```

Note which test each got: normality fails badly on the gamma-distributed
tenure, so the statistician selects Mann-Whitney rather than Welch's t, and
`contract_type` has three levels so it selects one-way ANOVA rather than
collapsing to a two-group comparison. Neither choice is proposed by the model.

Regenerate with `make_telecom_churn.py` (seed 42, so the numbers above are
reproducible).
