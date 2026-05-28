"""Leakage audit for ml_analysis.py"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split, GroupShuffleSplit
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import f1_score, roc_auc_score, r2_score

df = pd.read_csv("data/CAMO_DANE_TRAIN.csv", encoding="utf-8", encoding_errors="replace")
df["event_date"] = pd.to_datetime(df["event_date"])
df["damage_binary"] = (df["damage_found"] == "Yes").astype(int)

for col in ["operator", "aircraft_type", "check_type", "task_type_code", "system", "part_name"]:
    df[f"{col}_enc"] = LabelEncoder().fit_transform(df[col].astype(str))

df["fh_fc_ratio"] = df["aircraft_total_fh"] / df["aircraft_total_fc"].replace(0, 1)
df["part_usage_ratio"] = df["part_fh_since_last_inspection"] / df["aircraft_total_fh"].replace(0, 1)
df["repair_rate"] = df["n_previous_repairs"] / df["aircraft_age_years"].replace(0, 0.1)
df["hours_per_year"] = df["aircraft_total_fh"] / df["aircraft_age_years"].replace(0, 0.1)

features = [
    "aircraft_age_years", "aircraft_total_fh", "aircraft_total_fc",
    "part_fh_since_last_inspection", "part_fc_since_last_inspection",
    "n_previous_repairs", "corrosion_susceptibility", "ata_chapter",
    "operator_enc", "aircraft_type_enc", "check_type_enc", "task_type_code_enc",
    "system_enc", "part_name_enc",
    "fh_fc_ratio", "part_usage_ratio", "repair_rate", "hours_per_year",
]

X = df[features].values
y = df["damage_binary"].values

# ── TEST 1: Scaler fit before vs after split ─────────────────────
print("=" * 60)
print("  TEST 1: SCALER FIT BEFORE vs AFTER SPLIT")
print("=" * 60)

scaler_all = StandardScaler()
X_all = scaler_all.fit_transform(X)
X_tr1, X_te1, y_tr1, y_te1 = train_test_split(X_all, y, test_size=0.2, random_state=42, stratify=y)
rf1 = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
rf1.fit(X_tr1, y_tr1)
f1_leak = f1_score(y_te1, rf1.predict(X_te1))
auc_leak = roc_auc_score(y_te1, rf1.predict_proba(X_te1)[:, 1])
print(f"  Scaler on ALL data   -> F1={f1_leak:.4f}, AUC={auc_leak:.4f}")

X_tr2, X_te2, y_tr2, y_te2 = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
scaler_train = StandardScaler()
X_tr2 = scaler_train.fit_transform(X_tr2)
X_te2 = scaler_train.transform(X_te2)
rf2 = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
rf2.fit(X_tr2, y_tr2)
f1_clean = f1_score(y_te2, rf2.predict(X_te2))
auc_clean = roc_auc_score(y_te2, rf2.predict_proba(X_te2)[:, 1])
print(f"  Scaler on TRAIN only -> F1={f1_clean:.4f}, AUC={auc_clean:.4f}")
print(f"  Delta:                  F1={f1_leak - f1_clean:+.4f}, AUC={auc_leak - auc_clean:+.4f}")

# ── TEST 2: Random split vs temporal split ────────────────────────
print()
print("=" * 60)
print("  TEST 2: RANDOM SPLIT vs TEMPORAL SPLIT")
print("=" * 60)

# Random split
X_tr3, X_te3, y_tr3, y_te3 = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
sc3 = StandardScaler()
X_tr3 = sc3.fit_transform(X_tr3)
X_te3 = sc3.transform(X_te3)
rf3 = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
rf3.fit(X_tr3, y_tr3)
f1_rand = f1_score(y_te3, rf3.predict(X_te3))
auc_rand = roc_auc_score(y_te3, rf3.predict_proba(X_te3)[:, 1])

# Temporal split
df_sorted = df.sort_values("event_date").reset_index(drop=True)
cutoff = int(len(df_sorted) * 0.8)
train_df = df_sorted.iloc[:cutoff]
test_df = df_sorted.iloc[cutoff:]
X_tr4 = train_df[features].values
X_te4 = test_df[features].values
y_tr4 = train_df["damage_binary"].values
y_te4 = test_df["damage_binary"].values
sc4 = StandardScaler()
X_tr4 = sc4.fit_transform(X_tr4)
X_te4 = sc4.transform(X_te4)
rf4 = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
rf4.fit(X_tr4, y_tr4)
f1_temp = f1_score(y_te4, rf4.predict(X_te4))
auc_temp = roc_auc_score(y_te4, rf4.predict_proba(X_te4)[:, 1])

train_start = train_df["event_date"].min().strftime("%Y-%m-%d")
train_end = train_df["event_date"].max().strftime("%Y-%m-%d")
test_start = test_df["event_date"].min().strftime("%Y-%m-%d")
test_end = test_df["event_date"].max().strftime("%Y-%m-%d")

print(f"  Random split   -> F1={f1_rand:.4f}, AUC={auc_rand:.4f}")
print(f"  Temporal split  -> F1={f1_temp:.4f}, AUC={auc_temp:.4f}")
print(f"  Delta:            F1={f1_rand - f1_temp:+.4f}, AUC={auc_rand - auc_temp:+.4f}")
print(f"  Train period: {train_start} to {train_end}")
print(f"  Test  period: {test_start} to {test_end}")

# ── TEST 3: Tail number group leak ────────────────────────────────
print()
print("=" * 60)
print("  TEST 3: TAIL NUMBER GROUP LEAK")
print("=" * 60)

indices = np.arange(len(df))
_, _, idx_tr, idx_te = train_test_split(X, indices, test_size=0.2, random_state=42, stratify=y)
train_tails = set(df.iloc[idx_tr]["tail_number"].unique())
test_tails = set(df.iloc[idx_te]["tail_number"].unique())
overlap = train_tails & test_tails
print(f"  Train tails: {len(train_tails)}, Test tails: {len(test_tails)}")
print(f"  Overlapping: {len(overlap)} / {len(test_tails)} ({len(overlap)/len(test_tails)*100:.0f}%)")
print(f"  -> Same aircraft in BOTH train and test = group leakage risk")

# GroupShuffle split by tail
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
groups = df["tail_number"].values
tr_idx, te_idx = next(gss.split(X, y, groups))
X_tr5 = X[tr_idx]
X_te5 = X[te_idx]
y_tr5 = y[tr_idx]
y_te5 = y[te_idx]
sc5 = StandardScaler()
X_tr5 = sc5.fit_transform(X_tr5)
X_te5 = sc5.transform(X_te5)
rf5 = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
rf5.fit(X_tr5, y_tr5)
f1_group = f1_score(y_te5, rf5.predict(X_te5))
auc_group = roc_auc_score(y_te5, rf5.predict_proba(X_te5)[:, 1])
print(f"\n  Random split (tail overlap)    -> F1={f1_rand:.4f}, AUC={auc_rand:.4f}")
print(f"  GroupShuffle (no tail overlap) -> F1={f1_group:.4f}, AUC={auc_group:.4f}")
print(f"  Delta:                           F1={f1_rand - f1_group:+.4f}, AUC={auc_rand - auc_group:+.4f}")

# ── TEST 4: RUL regression — same tests ──────────────────────────
print()
print("=" * 60)
print("  TEST 4: RUL REGRESSION — RANDOM vs TEMPORAL")
print("=" * 60)
y_rul = df["RUL_flight_hours"].values

# Random
X_tr6, X_te6, yr_tr6, yr_te6 = train_test_split(X, y_rul, test_size=0.2, random_state=42)
sc6 = StandardScaler()
X_tr6 = sc6.fit_transform(X_tr6)
X_te6 = sc6.transform(X_te6)
rfr1 = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
rfr1.fit(X_tr6, yr_tr6)
r2_rand = r2_score(yr_te6, rfr1.predict(X_te6))

# Temporal
yr_tr7 = df_sorted.iloc[:cutoff]["RUL_flight_hours"].values
yr_te7 = df_sorted.iloc[cutoff:]["RUL_flight_hours"].values
X_tr7 = df_sorted.iloc[:cutoff][features].values
X_te7 = df_sorted.iloc[cutoff:][features].values
sc7 = StandardScaler()
X_tr7 = sc7.fit_transform(X_tr7)
X_te7 = sc7.transform(X_te7)
rfr2 = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
rfr2.fit(X_tr7, yr_tr7)
r2_temp = r2_score(yr_te7, rfr2.predict(X_te7))

print(f"  Random split  -> R2={r2_rand:.4f}")
print(f"  Temporal split -> R2={r2_temp:.4f}")
print(f"  Delta:           R2={r2_rand - r2_temp:+.4f}")

# ── SUMMARY ───────────────────────────────────────────────────────
print()
print("=" * 60)
print("  SUMMARY OF LEAKAGE FINDINGS")
print("=" * 60)
print("""
  ISSUE 1 (minor): StandardScaler fit on FULL data before split
    -> Test data statistics leak into scaling
    -> Impact: minimal for tree-based models, minor for SVM/KNN/LogReg

  ISSUE 2 (MAJOR): Random train/test split instead of temporal split
    -> Future events leak into training set
    -> The business case is: train on PAST, predict FUTURE
    -> Impact: metrics may be inflated

  ISSUE 3 (moderate): Same aircraft (tail) in both train and test
    -> Model can memorize per-aircraft patterns
    -> In production, you'd predict for known aircraft, so this is
       partially acceptable, but still inflates metrics

  ISSUE 4 (safe): Feature set does NOT contain post-event columns
    -> damage_found, failure_mode, severity, action_taken,
       maintenance_hours, cost_eur are NOT used as features ✓
    -> severity_score IS a target, NOT a feature ✓
""")
