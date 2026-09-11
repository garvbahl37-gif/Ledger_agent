"""
Generate the PLANTED sample table.

Two real relationships, the rest independent noise. Seeded, so the p-values in
this directory's README reproduce exactly.
"""
import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
n = 1400

churn = rng.binomial(1, 0.27, n)
# Planted: churned customers have substantially shorter tenure.
tenure = np.where(churn == 1, rng.gamma(2.0, 9.0, n), rng.gamma(4.5, 9.0, n))

# Planted: monthly charges differ by contract type.
contract = rng.choice(["Month-to-month", "One year", "Two year"], n, p=[.55, .25, .20])
base = {"Month-to-month": 74, "One year": 64, "Two year": 60}
monthly = np.array([rng.normal(base[c], 18) for c in contract]).clip(18, 130)

df = pd.DataFrame({
    "customer_id": [f"C{i:05d}" for i in range(n)],
    "tenure_months": tenure.round(0).astype(int).clip(0, 72),
    "monthly_charges": monthly.round(2),
    "contract_type": contract,
    "churned": np.where(churn == 1, "Yes", "No"),
    # Independent of everything above — the correct number of findings here is zero.
    "support_calls": rng.poisson(2.4, n),
    "satisfaction": rng.integers(1, 6, n),
    "region": rng.choice(["North", "South", "East", "West"], n),
    "paperless": rng.choice(["Yes", "No"], n),
})
df.loc[rng.choice(n, 60, replace=False), "satisfaction"] = np.nan

df.to_csv("telecom_churn.csv", index=False)
print(f"wrote telecom_churn.csv — {df.shape[0]} rows x {df.shape[1]} columns")
