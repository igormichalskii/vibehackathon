"""Generate synthetic ADS-B operational history for a European B737 fleet (2018-05 -> 2026-05)."""

import numpy as np
import pandas as pd
from datetime import date, timedelta

REFERENCE_DATE = date(2026, 5, 22)
START_DATE     = date(2018, 5, 1)
N_DAYS         = (REFERENCE_DATE - START_DATE).days   # 2922 days
PRE_DAYS       = 730   # 2-year warm-up so planes manufactured before 2018 have a realistic C-check phase
TOTAL_DAYS     = N_DAYS + PRE_DAYS
SIM_START      = START_DATE - timedelta(days=PRE_DAYS)

N_AIRCRAFT     = 220
SEED           = 42
AOG_PROB       = 0.03   # 3% of days aircraft on ground (non-C-check)
ANOMALY_RATE   = 0.12   # 12% of fleet has anomalous C-check behaviour
OUTPUT_PATH    = "data/mock_adsb.csv"

# (operator_name, registration_prefix, aircraft_count, base_flight_hours_per_day)
DELIVERIES_PATH = "data/adsb_deliveries.csv"

OPERATOR_CONFIG = [
    ("LOT Polish",  "SP-L", 30,  8.0),
    ("Ryanair",     "EI-D", 50, 10.0),
    ("Lufthansa",   "D-A",  25,  9.0),
    ("Enter Air",   "SP-E", 20,  7.0),
    ("KLM",         "PH-B", 20,  8.5),
    ("TUI fly",     "OO-J", 20,  7.5),
    ("SunExpress",  "TC-S", 20,  8.0),
    ("Norwegian",   "LN-N", 15,  9.0),
    ("Smartwings",  "OK-S", 10,  7.0),
    ("Corendon",    "TC-C", 10,  7.5),
]

_ALPHA   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_SUFFIX2 = [f"{a}{b}" for a in _ALPHA for b in _ALPHA]   # 676 unique 2-letter combos


def build_roster(rng: np.random.Generator) -> list[dict]:
    is_anomaly = rng.random(N_AIRCRAFT) < ANOMALY_RATE
    roster, idx = [], 0
    for op_name, prefix, count, base_fh in OPERATOR_CONFIG:
        suf_idx = rng.choice(len(_SUFFIX2), size=count, replace=False)
        for si in suf_idx:
            yr  = int(rng.integers(2010, 2024))
            doy = int(rng.integers(0, 365))
            mfr = date(yr, 1, 1) + timedelta(days=doy)
            mfr_offset = max(0, (mfr - SIM_START).days)
            roster.append({
                "registration":  f"{prefix}{_SUFFIX2[si]}",
                "operator":      op_name,
                "base_fh":       base_fh,
                # days from SIM_START to manufacture (0 if manufactured before our window)
                "mfr_offset":    mfr_offset,
                "delivery_date": SIM_START + timedelta(days=mfr_offset),
                "is_anomaly":    bool(is_anomaly[idx]),
            })
            idx += 1
    return roster


def simulate(roster: list[dict], rng: np.random.Generator):
    n   = len(roster)
    bfh = np.array([ac["base_fh"] for ac in roster])   # (n,)

    # ── 1. Raw daily FH: operator base rate + Gaussian ±15% noise ──────────────
    fh = np.maximum(
        0.0,
        bfh[:, None] * (1.0 + rng.normal(0.0, 0.15, (n, TOTAL_DAYS))),
    )

    # ── 2. AOG days (non-C-check): 3% of days → 0 FH ──────────────────────────
    fh[rng.random((n, TOTAL_DAYS)) < AOG_PROB] = 0.0

    # ── 3. Pre-manufacture: zero out ───────────────────────────────────────────
    for i, ac in enumerate(roster):
        if ac["mfr_offset"] > 0:
            fh[i, : ac["mfr_offset"]] = 0.0

    # ── 4. Prepare in_service and event arrays ─────────────────────────────────
    in_service = np.ones((n, TOTAL_DAYS), dtype=np.int8)
    events     = np.empty((n, TOTAL_DAYS), dtype=object)
    events[:]  = ""

    for i, ac in enumerate(roster):
        if ac["mfr_offset"] > 0:
            in_service[i, : ac["mfr_offset"]] = 0

    # ── 5. C-check scheduling (per aircraft, O(n_checks) not O(days)) ──────────
    # Triggering rule: next C-check when EITHER
    #   • time since last check ≥ interval  (18-24 months normal / 15-18 anomaly)
    #   • accumulated FH since last check ≥ fh_limit  (5500-6500 normal / 4000-5000 anomaly)
    # Whichever comes first.
    n_checks_visible = 0
    all_intervals: list[int] = []

    for i, ac in enumerate(roster):
        fh_ac    = fh[i].copy()   # local mutable copy so previous checks zero out FH
        is_anom  = ac["is_anomaly"]
        last_end = max(0, ac["mfr_offset"])
        prev_cs: int | None = None

        while last_end < TOTAL_DAYS - 30:
            if is_anom:
                fh_limit = float(rng.integers(4_000, 5_000))
                interval = int(rng.integers(450, 540))    # 15-18 months
                duration = int(rng.integers(46, 61))      # longer downtime
            else:
                fh_limit = float(rng.integers(5_500, 6_500))
                interval = int(rng.integers(540, 730))    # 18-24 months
                duration = int(rng.integers(25, 46))

            # FH trigger: find first day where cumulative FH (from last_end) ≥ limit
            seg_cum = np.cumsum(fh_ac[last_end:])
            fh_day  = last_end + int(np.searchsorted(seg_cum, fh_limit))

            # Time trigger
            time_day = last_end + interval

            cs = int(min(fh_day, time_day))
            if cs >= TOTAL_DAYS:
                break

            ce = min(cs + duration, TOTAL_DAYS)

            # Apply C-check
            fh_ac[cs:ce]         = 0.0
            in_service[i, cs:ce] = 0
            events[i, cs]        = "C-check_start"
            events[i, ce - 1]    = "C-check_end"

            if prev_cs is not None:
                all_intervals.append(cs - prev_cs)
            if cs >= PRE_DAYS:
                n_checks_visible += 1

            prev_cs  = cs
            last_end = ce

        fh[i] = fh_ac   # write back (C-check windows are now zeroed)

    # ── 6. Slice to visible output window ──────────────────────────────────────
    return (
        fh[:, PRE_DAYS:],
        in_service[:, PRE_DAYS:],
        events[:, PRE_DAYS:],
        n_checks_visible,
        all_intervals,
    )


def build_df(roster, fh_out, ins_out, ev_out) -> pd.DataFrame:
    dates = [START_DATE + timedelta(days=d) for d in range(N_DAYS)]
    return pd.DataFrame({
        "date":             np.tile(dates, N_AIRCRAFT),
        "registration":     np.repeat([ac["registration"] for ac in roster], N_DAYS),
        "operator":         np.repeat([ac["operator"]     for ac in roster], N_DAYS),
        "flight_hours_day": np.round(fh_out.ravel(), 1),
        "in_service":       ins_out.ravel().astype(int),
        "event":            ev_out.ravel(),
    })


def main():
    rng    = np.random.default_rng(SEED)
    roster = build_roster(rng)
    fh_out, ins_out, ev_out, n_checks, intervals = simulate(roster, rng)
    df     = build_df(roster, fh_out, ins_out, ev_out)
    df.to_csv(OUTPUT_PATH, index=False)

    # Side-output: delivery dates for generate_fleet.py
    pd.DataFrame({
        "registration":  [ac["registration"]  for ac in roster],
        "operator":      [ac["operator"]      for ac in roster],
        "delivery_date": [ac["delivery_date"] for ac in roster],
    }).to_csv(DELIVERIES_PATH, index=False)

    mean_iv = f"{np.mean(intervals):.0f}" if intervals else "N/A"
    print(f"Samolotow        : {N_AIRCRAFT}")
    print(f"Rekordow         : {len(df):,}")
    print(f"C-checkow obs.   : {n_checks}")
    print(f"Sr. interwal     : {mean_iv} dni (miedzy kolejnymi C-checkami)")


if __name__ == "__main__":
    main()
