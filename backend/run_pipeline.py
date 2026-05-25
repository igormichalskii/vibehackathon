"""Master pipeline orchestrator — runs all steps via subprocess and validates output."""

import re
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd

PYTHON = sys.executable
SRC    = Path(__file__).parent / "src"

STEPS = [
    (1, "generate_mock_adsb.py"),
    (2, "generate_fleet.py"),
    (3, "train_predictor.py"),
    (4, "filter_golden_window.py"),
]

LEADS_PATH      = Path("data/lotams_prediction_leads.csv")
EXPECTED_COLS   = [
    "Rejestracja", "Operator", "Wiek", "Ostatnie okno",
    "Czas trwania", "Typ checku", "Prognoza C-check",
]
RE_QUARTER      = re.compile(r"^Q[1-4] \d{4}$")
RE_DURATION     = re.compile(r"^\d+ dni$")


# ─────────────────────────────────────────────────────────────────────────────
# STEP RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def _safe(text: bytes) -> str:
    """Decode subprocess bytes to a string printable on any console."""
    return text.decode("utf-8", errors="replace").encode("ascii", errors="replace").decode("ascii")


def run_step(n: int, script: str) -> float:
    print(f"\nSTEP {n}: {script}")
    t0  = time.perf_counter()
    res = subprocess.run(
        [PYTHON, str(SRC / script)],
        capture_output=True,
    )
    elapsed = time.perf_counter() - t0

    stdout = _safe(res.stdout)
    stderr = _safe(res.stderr)

    if stdout.strip():
        for line in stdout.rstrip().splitlines():
            print(f"  | {line}")

    if res.returncode != 0:
        print(f"\nX STEP {n} FAILED (exit {res.returncode})")
        if stderr.strip():
            for line in stderr.rstrip().splitlines():
                print(f"  ! {line}")
        sys.exit(1)

    print(f"OK STEP {n} done in {elapsed:.2f} s")
    return elapsed


# ─────────────────────────────────────────────────────────────────────────────
# CSV VALIDATOR
# ─────────────────────────────────────────────────────────────────────────────

def validate_leads() -> None:
    print("\n" + "-" * 56)
    print("VALIDATING final CSV...")

    errors = []

    # 1. file exists
    if not LEADS_PATH.exists():
        print(f"  FAIL: {LEADS_PATH} not found")
        sys.exit(1)

    df = pd.read_csv(LEADS_PATH, dtype=str, encoding="utf-8")

    # 2. exact column names and order
    if list(df.columns) != EXPECTED_COLS:
        errors.append(
            f"  FAIL: columns mismatch\n"
            f"    expected : {EXPECTED_COLS}\n"
            f"    got      : {list(df.columns)}"
        )

    # 3. Typ checku == 'C-check' everywhere
    if "Typ checku" in df.columns:
        bad = df[df["Typ checku"] != "C-check"]
        if not bad.empty:
            errors.append(f"  FAIL: {len(bad)} rows where 'Typ checku' != 'C-check'")

    # 4. Prognoza C-check matches Q[1-4] YYYY
    if "Prognoza C-check" in df.columns:
        bad = df[~df["Prognoza C-check"].str.match(RE_QUARTER, na=False)]
        if not bad.empty:
            errors.append(
                f"  FAIL: {len(bad)} rows where 'Prognoza C-check' does not match r'^Q[1-4] \\d{{4}}$'"
            )

    # 5. Czas trwania matches \d+ dni
    if "Czas trwania" in df.columns:
        bad = df[~df["Czas trwania"].str.match(RE_DURATION, na=False)]
        if not bad.empty:
            errors.append(
                f"  FAIL: {len(bad)} rows where 'Czas trwania' does not match r'^\\d+ dni$'"
            )

    if errors:
        for e in errors:
            print(e)
        print("X VALIDATION FAILED")
        sys.exit(1)

    n_leads = len(df)
    print(f"OK FINAL CSV VALID -- {n_leads} leads ready for LOTAMS")
    print("-" * 56)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 56)
    print("  LOTAMS C-Check Prediction Engine")
    print("  Reference date : 2026-05-22")
    print("  Golden window  : 180-540 days (~6-18 months)")
    print("=" * 56)

    total_t0 = time.perf_counter()

    for n, script in STEPS:
        run_step(n, script)

    validate_leads()

    elapsed = time.perf_counter() - total_t0
    print(f"\nPipeline finished in {elapsed:.1f} s")
    print(f"Output : {LEADS_PATH}")
    print("=" * 56)


if __name__ == "__main__":
    main()
