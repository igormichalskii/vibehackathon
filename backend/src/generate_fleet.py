# W wersji produkcyjnej tu szedlby scraper bs4 do planespotters.net / radarbox,
# pobierajacy delivery_date, variant i operator z HTML per rejestracja.
# Na razie mockujemy na podstawie mock_adsb.csv, zeby dane byly spojne miedzy plikami.
# delivery_date pochodzi z adsb_deliveries.csv (side-output generate_mock_adsb.py);
# fallback: MIN(date) per rejestracja z mock_adsb.csv (= granica datasetu dla starszych AC).

"""Build europe_fleet.csv — snapshot of the European B737 fleet as of 2026-05-22."""

import numpy as np
import pandas as pd
from datetime import date
from pathlib import Path

REFERENCE_DATE    = date(2026, 5, 22)
SEED              = 42
ADSB_PATH         = "data/mock_adsb.csv"
DELIVERIES_PATH   = "data/adsb_deliveries.csv"
OUTPUT_PATH       = "data/europe_fleet.csv"

VARIANTS          = ["B737-800", "B737 MAX 8"]


def _age_years(delivery: date, ref: date) -> int:
    """Full completed years between delivery date and reference date."""
    years = ref.year - delivery.year
    if (ref.month, ref.day) < (delivery.month, delivery.day):
        years -= 1
    return max(0, years)


def build_fleet() -> pd.DataFrame:
    rng  = np.random.default_rng(SEED)

    # ── 1. unique (registration, operator) + first ADS-B date as fallback ──────
    adsb = pd.read_csv(
        ADSB_PATH, parse_dates=["date"],
        usecols=["date", "registration", "operator"],
    )
    roster = (
        adsb.sort_values("date")
            .groupby("registration", sort=False)
            .agg(operator=("operator", "first"), first_date=("date", "min"))
            .reset_index()
    )

    # ── 2. delivery_date: prefer adsb_deliveries.csv (has true mfr dates) ───────
    if Path(DELIVERIES_PATH).exists():
        deliveries = pd.read_csv(DELIVERIES_PATH, parse_dates=["delivery_date"])
        roster = roster.merge(deliveries[["registration", "delivery_date"]], on="registration", how="left")
        # fill any gaps with first ADS-B date
        missing = roster["delivery_date"].isna()
        roster.loc[missing, "delivery_date"] = roster.loc[missing, "first_date"]
    else:
        roster["delivery_date"] = roster["first_date"]

    roster["delivery_date"] = pd.to_datetime(roster["delivery_date"]).dt.date
    roster.drop(columns="first_date", inplace=True)

    # ── 3. age in full years on REFERENCE_DATE ───────────────────────────────────
    roster["age_years"] = roster["delivery_date"].apply(
        lambda d: _age_years(d, REFERENCE_DATE)
    )

    # ── 4. variant: 70/30 B737-800/MAX 8 with delivery-year bias ─────────────────
    # aircraft delivered from 2017 onwards skew toward MAX 8 (entered service ~2017)
    cutoff = date(2017, 1, 1)

    def pick_variant(delivery: date) -> str:
        weights = [0.40, 0.60] if delivery >= cutoff else [0.92, 0.08]
        return rng.choice(VARIANTS, p=weights)

    roster["variant"] = roster["delivery_date"].apply(pick_variant)

    # Overall target: ~70/30 is approximate; exact split depends on fleet age mix.

    cols = ["registration", "operator", "age_years", "variant", "delivery_date"]
    return roster[cols]


def main() -> None:
    df = build_fleet()
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"europe_fleet.csv  ->  {len(df)} aircraft\n")
    print(df.head(10).to_string(index=False))
    print()
    print("--- samolotow per operator ---")
    print(df["operator"].value_counts().to_string())
    print()
    print("--- warianty ogolnie ---")
    print(df["variant"].value_counts().to_string())
    print()
    print("--- sredni wiek per operator [lata] ---")
    print(
        df.groupby("operator")["age_years"]
          .mean().round(1)
          .sort_values(ascending=False)
          .to_string()
    )
    print()
    print("--- rozklad wiekow (histogram) ---")
    print(df["age_years"].value_counts().sort_index().to_string())


if __name__ == "__main__":
    main()
