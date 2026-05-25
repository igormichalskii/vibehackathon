"""Train RandomForestRegressor to predict days until next C-check.

Feature engineering: one training row per consecutive C-check PAIR per aircraft.
Target: days_to_next_check = curr_check_start - prev_check_start
"""

import pickle
import warnings
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

REFERENCE_DATE   = date(2026, 5, 22)
ADSB_PATH        = "data/mock_adsb.csv"
FLEET_PATH       = "data/europe_fleet.csv"
DELIVERIES_PATH  = "data/adsb_deliveries.csv"
PREDICTIONS_PATH = "data/predictions_raw.csv"
MODEL_PATH       = "data/ccheck_model.pkl"
SEED             = 42

RF_PARAMS = dict(n_estimators=300, max_depth=12, random_state=SEED, n_jobs=-1)

# Numeric feature columns (categoricals added via OHE)
BASE_FEATS = [
    "age_at_check_years",
    "prev_interval_days",
    "avg_burn_rate_h_per_day",
    "total_hours_since_prev_check",
    "aog_ratio",
    "num_prev_checks",
]


# ─────────────────────────────────────────────────────────────────────────────
# DATA LOADING
# ─────────────────────────────────────────────────────────────────────────────

def load_data():
    adsb = pd.read_csv(ADSB_PATH, parse_dates=["date"])
    fleet = pd.read_csv(FLEET_PATH, parse_dates=["delivery_date"])
    if Path(DELIVERIES_PATH).exists():
        deliveries = pd.read_csv(DELIVERIES_PATH, parse_dates=["delivery_date"])
    else:
        deliveries = fleet[["registration", "delivery_date"]].copy()
    return adsb, fleet, deliveries


# ─────────────────────────────────────────────────────────────────────────────
# C-CHECK EVENT EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_checks(adsb: pd.DataFrame) -> pd.DataFrame:
    """Return one row per C-check: registration, check_start, check_end, duration_days.

    Uses a state machine to match each C-check_start with the next C-check_end.
    Orphaned C-check_end events (check started in PRE_DAYS warm-up, ended in visible
    window) are discarded — they have no matching start in our data.
    """
    ev = adsb.loc[adsb["event"].isin(["C-check_start", "C-check_end"])].copy()
    ev = ev.sort_values(["registration", "date"]).reset_index(drop=True)

    records = []
    for reg, grp in ev.groupby("registration"):
        pending = None
        for _, row in grp.iterrows():
            if row["event"] == "C-check_start":
                pending = row["date"]
            elif row["event"] == "C-check_end" and pending is not None:
                records.append({"registration": reg, "check_start": pending, "check_end": row["date"]})
                pending = None
            # C-check_end without a prior start → orphan from warm-up, skip

    df = pd.DataFrame(records)
    df["duration_days"] = (df["check_end"] - df["check_start"]).dt.days + 1
    return df


# ─────────────────────────────────────────────────────────────────────────────
# WINDOW FEATURE HELPER
# ─────────────────────────────────────────────────────────────────────────────

def _window_feats(
    adsb_ac: pd.DataFrame,
    win_start: pd.Timestamp,
    win_end: pd.Timestamp,
) -> dict:
    """Compute burn-rate / AOG features for one aircraft in [win_start, win_end]."""
    if adsb_ac.empty or win_end < win_start:
        return {"avg_burn_rate_h_per_day": 0.0,
                "total_hours_since_prev_check": 0.0,
                "aog_ratio": 0.0}

    mask   = (adsb_ac["date"] >= win_start) & (adsb_ac["date"] <= win_end)
    window = adsb_ac.loc[mask]
    if window.empty:
        return {"avg_burn_rate_h_per_day": 0.0,
                "total_hours_since_prev_check": 0.0,
                "aog_ratio": 0.0}

    n_days   = len(window)
    active   = window.loc[window["in_service"] == 1]
    n_active = len(active)

    return {
        # mean FH on days aircraft actually flew (excludes AOG and C-check days)
        "avg_burn_rate_h_per_day":      round(float(active["flight_hours_day"].mean()) if n_active else 0.0, 3),
        "total_hours_since_prev_check": round(float(window["flight_hours_day"].sum()), 1),
        "aog_ratio":                    round(1.0 - n_active / n_days, 4) if n_days else 0.0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING  (training rows)
# ─────────────────────────────────────────────────────────────────────────────

def build_training_data(
    adsb: pd.DataFrame,
    checks: pd.DataFrame,
    fleet: pd.DataFrame,
    deliveries: pd.DataFrame,
) -> pd.DataFrame:
    """One training row per consecutive C-check pair per aircraft."""
    adsb_by_reg = {reg: g.reset_index(drop=True) for reg, g in adsb.groupby("registration")}
    op_lookup   = adsb.groupby("registration")["operator"].first().to_dict()
    del_lookup  = deliveries.set_index("registration")["delivery_date"].to_dict()
    var_lookup  = fleet.set_index("registration")["variant"].to_dict()

    rows = []
    for reg, grp in checks.groupby("registration"):
        grp = grp.sort_values("check_start").reset_index(drop=True)
        n   = len(grp)
        if n < 2:
            continue

        adsb_ac  = adsb_by_reg.get(reg, pd.DataFrame())
        delivery = del_lookup.get(reg, pd.NaT)
        operator = op_lookup.get(reg, "Unknown")
        variant  = var_lookup.get(reg, "B737-800")

        starts    = grp["check_start"].tolist()
        ends      = grp["check_end"].tolist()
        intervals = [(starts[i] - starts[i - 1]).days for i in range(1, n)]

        for i in range(1, n):
            prev_start = starts[i - 1]
            prev_end   = ends[i - 1]
            curr_start = starts[i]

            age = (
                (prev_start - pd.Timestamp(delivery)).days / 365.25
                if pd.notna(delivery) else np.nan
            )
            prev_interval = intervals[i - 2] if i >= 2 else np.nan

            wf = _window_feats(
                adsb_ac,
                prev_end   + timedelta(days=1),
                curr_start - timedelta(days=1),
            )

            rows.append({
                "registration":          reg,
                "operator":              operator,
                "variant":               variant,
                "age_at_check_years":    round(float(age), 2) if not np.isnan(age) else np.nan,
                "prev_interval_days":    prev_interval,
                "num_prev_checks":       i,
                "days_to_next_check":    intervals[i - 1],   # ← target
                **wf,
            })

    df = pd.DataFrame(rows)
    median_iv  = df["prev_interval_days"].median()
    median_age = df["age_at_check_years"].median()
    df["prev_interval_days"]  = df["prev_interval_days"].fillna(median_iv)
    df["age_at_check_years"]  = df["age_at_check_years"].fillna(median_age)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# TRAINING
# ─────────────────────────────────────────────────────────────────────────────

def train_model(df: pd.DataFrame):
    """One-hot encode, split, fit RF, print metrics. Returns (model, feat_cols)."""
    dummies = pd.get_dummies(df, columns=["operator", "variant"], drop_first=False, dtype=int)
    ohe_cols  = [c for c in dummies.columns if c.startswith("operator_") or c.startswith("variant_")]
    feat_cols = BASE_FEATS + ohe_cols

    X = dummies[feat_cols]
    y = dummies["days_to_next_check"]

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=SEED)

    model = RandomForestRegressor(**RF_PARAMS)
    model.fit(X_tr, y_tr)

    y_pred = model.predict(X_te)
    mae    = mean_absolute_error(y_te, y_pred)
    r2     = r2_score(y_te, y_pred)

    importances = pd.Series(model.feature_importances_, index=feat_cols).nlargest(5)

    sep = "-" * 52
    print(f"\n{sep}")
    print(f"  MAE       : {mae:.1f} days")
    print(f"  R2        : {r2:.4f}")
    print(f"  Train / Test rows : {len(X_tr)} / {len(X_te)}")
    print(sep)
    print("  Top-5 feature importances:")
    for feat, imp in importances.items():
        bar = "#" * int(imp * 200)
        print(f"    {feat:<40} {imp:.4f}  {bar}")
    print(f"{sep}\n")

    return model, feat_cols


# ─────────────────────────────────────────────────────────────────────────────
# INFERENCE
# ─────────────────────────────────────────────────────────────────────────────

def run_inference(
    model,
    feat_cols: list,
    adsb: pd.DataFrame,
    fleet: pd.DataFrame,
    checks: pd.DataFrame,
    deliveries: pd.DataFrame,
    training_df: pd.DataFrame,
) -> pd.DataFrame:
    """Predict next C-check date for every aircraft in fleet."""
    ref             = pd.Timestamp(REFERENCE_DATE)
    median_interval = training_df["prev_interval_days"].median()

    adsb_by_reg = {reg: g.reset_index(drop=True) for reg, g in adsb.groupby("registration")}
    del_lookup  = deliveries.set_index("registration")["delivery_date"].to_dict()
    var_lookup  = fleet.set_index("registration")["variant"].to_dict()
    op_lookup   = fleet.set_index("registration")["operator"].to_dict()
    age_lookup  = fleet.set_index("registration")["age_years"].to_dict()

    # categories seen during training (for consistent OHE)
    known_ops  = sorted(training_df["operator"].unique())
    known_vars = sorted(training_df["variant"].unique())

    records = []
    skipped = 0

    for _, ac in fleet.iterrows():
        reg = ac["registration"]
        ac_checks = checks[checks["registration"] == reg].sort_values("check_start")

        if ac_checks.empty:
            warnings.warn(f"WARNING: {reg} ({ac['operator']}) has no C-check history — skipped")
            skipped += 1
            continue

        last      = ac_checks.iloc[-1]
        last_start = last["check_start"]
        last_end   = last["check_end"]
        n_checks   = len(ac_checks)

        last_check_window   = last_end.strftime("%b %Y")
        last_check_duration = int(last["duration_days"])

        delivery = del_lookup.get(reg, pd.NaT)
        age = (
            (last_start - pd.Timestamp(delivery)).days / 365.25
            if pd.notna(delivery) else float(age_lookup.get(reg, 8))
        )

        if n_checks >= 2:
            prev_start    = ac_checks.iloc[-2]["check_start"]
            prev_interval = (last_start - prev_start).days
        else:
            prev_interval = median_interval

        wf = _window_feats(
            adsb_by_reg.get(reg, pd.DataFrame()),
            last_end + timedelta(days=1),
            ref,
        )

        operator = op_lookup.get(reg, "Unknown")
        variant  = var_lookup.get(reg, "B737-800")

        row = {
            "age_at_check_years":    round(age, 2),
            "prev_interval_days":    prev_interval,
            "num_prev_checks":       n_checks,
            **wf,
        }
        for op in known_ops:
            row[f"operator_{op}"] = int(operator == op)
        for v in known_vars:
            row[f"variant_{v}"] = int(variant == v)

        feat_vec   = pd.DataFrame([row]).reindex(columns=feat_cols, fill_value=0)
        pred_days  = float(model.predict(feat_vec)[0])
        pred_date  = last_start + timedelta(days=int(round(pred_days)))
        days_delta = (pred_date - ref).days

        records.append({
            "registration":              reg,
            "operator":                  operator,
            "age_years":                 int(ac["age_years"]),
            "last_check_window":         last_check_window,
            "last_check_duration_days":  last_check_duration,
            "predicted_next_check_date": pred_date.strftime("%Y-%m-%d"),
            "days_from_today":           int(days_delta),
        })

    if skipped:
        print(f"  [WARN] Skipped {skipped} aircraft with no C-check history")

    return pd.DataFrame(records).sort_values("days_from_today").reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("Loading data...")
    adsb, fleet, deliveries = load_data()

    print("Extracting C-check events...")
    checks = extract_checks(adsb)
    print(f"  Total C-checks in dataset : {len(checks)}")

    print("Building training features...")
    df_train = build_training_data(adsb, checks, fleet, deliveries)
    print(f"  Training rows  : {len(df_train)}")
    target   = df_train["days_to_next_check"]
    print(f"  Target range   : {target.min():.0f} – {target.max():.0f} days  (mean={target.mean():.0f})")

    print("\nTraining RandomForestRegressor...")
    model, feat_cols = train_model(df_train)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, "feat_cols": feat_cols}, f)
    print(f"Model saved -> {MODEL_PATH}")

    print("Running inference on current fleet...")
    predictions = run_inference(model, feat_cols, adsb, fleet, checks, deliveries, df_train)
    predictions.to_csv(PREDICTIONS_PATH, index=False)
    print(f"Predictions saved -> {PREDICTIONS_PATH}  ({len(predictions)} aircraft)\n")
    print(predictions.head(10).to_string(index=False))


if __name__ == "__main__":
    main()
