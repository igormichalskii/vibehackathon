"""Filter predictions_raw.csv to the golden window and produce the final leads CSV."""

import pandas as pd

PREDICTIONS_PATH = "data/predictions_raw.csv"
OUTPUT_PATH      = "data/lotams_prediction_leads.csv"

GOLDEN_MIN_DAYS  = 180   # ~6 months
GOLDEN_MAX_DAYS  = 540   # ~18 months

OUTPUT_COLUMNS = [
    "Rejestracja",
    "Operator",
    "Wiek",
    "Ostatnie okno",
    "Czas trwania",
    "Typ checku",
    "Prognoza C-check",
]


def _quarter(dt: pd.Timestamp) -> str:
    """'Q2 2027' from a Timestamp."""
    return f"Q{(dt.month - 1) // 3 + 1} {dt.year}"


def _quarter_sort_key(q: str) -> tuple:
    """('Q2 2027' -> (2027, 2)) for chronological sort."""
    parts = q.split()
    return (int(parts[1]), int(parts[0][1]))


def build_leads() -> pd.DataFrame:
    raw = pd.read_csv(PREDICTIONS_PATH, parse_dates=["predicted_next_check_date"])

    # ── 1. Golden-window filter ───────────────────────────────────────────────
    mask   = (raw["days_from_today"] >= GOLDEN_MIN_DAYS) & (raw["days_from_today"] <= GOLDEN_MAX_DAYS)
    golden = raw[mask].copy()

    # ── 2. Derived columns ────────────────────────────────────────────────────
    golden["Prognoza C-check"] = golden["predicted_next_check_date"].apply(_quarter)

    leads = pd.DataFrame({
        "Rejestracja":    golden["registration"].values,
        "Operator":       golden["operator"].values,
        "Wiek":           golden["age_years"].astype(int).values,
        "Ostatnie okno":  golden["last_check_window"].values,
        "Czas trwania":   golden["last_check_duration_days"].astype(int).apply(lambda d: f"{d} dni").values,
        "Typ checku":     "C-check",
        "Prognoza C-check": golden["Prognoza C-check"].values,
    })[OUTPUT_COLUMNS]

    # ── 3. Sort by quarter (chronologically), then operator for stable order ──
    leads["_sort_key"] = leads["Prognoza C-check"].apply(_quarter_sort_key)
    leads = (
        leads.sort_values(["_sort_key", "Operator", "Rejestracja"])
             .drop(columns="_sort_key")
             .reset_index(drop=True)
    )

    return leads, raw


def main() -> None:
    leads, raw = build_leads()
    leads.to_csv(OUTPUT_PATH, index=False, encoding="utf-8")

    total      = len(raw)
    too_soon   = (raw["days_from_today"] < GOLDEN_MIN_DAYS).sum()
    too_far    = (raw["days_from_today"] > GOLDEN_MAX_DAYS).sum()
    in_window  = len(leads)

    print(f"Total aircraft in predictions : {total}")
    print(f"  Odrzucone (< {GOLDEN_MIN_DAYS} dni / za blisko)  : {too_soon}")
    print(f"  Odrzucone (> {GOLDEN_MAX_DAYS} dni / za daleko)  : {too_far}")
    print(f"  W zlotym oknie (leady)        : {in_window}")
    print()
    print("--- leady per operator ---")
    print(leads["Operator"].value_counts().to_string())
    print()
    print("--- rozklad kwartalny ---")
    print(leads["Prognoza C-check"].value_counts().sort_index().to_string())
    print()

    if in_window < 40:
        print(f"=== Pelna zawartosc {OUTPUT_PATH} ({in_window} wierszy) ===")
        print(leads.to_string(index=False))
    else:
        print(f"=== head(20) ===")
        print(leads.head(20).to_string(index=False))
        print(f"\n=== tail(5) ===")
        print(leads.tail(5).to_string(index=False))


if __name__ == "__main__":
    main()
