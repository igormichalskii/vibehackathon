"""FastAPI backend — /api/aircraft, /api/stats + /api/radar/* for the LOTAMS frontend."""

from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Any, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# ── paths ────────────────────────────────────────────────────────────────────
LEADS_PATH       = Path(__file__).parent / "data" / "lotams_prediction_leads.csv"
GEO_DIR          = Path(__file__).parent / "data"
OUTPUT_DIR       = Path(__file__).parent / "output"
RISK_REPORT_PATH = OUTPUT_DIR / "ccheck_risk_report.csv"
METRICS_PATHS    = {
    "task1": OUTPUT_DIR / "task1_damage_metrics.csv",
    "task2": OUTPUT_DIR / "task2_severity_metrics.csv",
    "task3": OUTPUT_DIR / "task3_rul_metrics.csv",
}

REF_DATE = date(2026, 5, 22)

QUARTER_MIDPOINTS = {
    "Q1": (2, 15),
    "Q2": (5, 15),
    "Q3": (8, 15),
    "Q4": (11, 15),
}

SEVERITY_COLORS = {"critical": "#DC2626", "warning": "#F59E0B"}

GEO_FILES = {
    "airspaces":   ("geo_airspaces.csv", True),
    "routes":      ("geo_routes.csv",    True),
    "airports":    ("geo_airports.csv",  True),
    "impact":      ("geo_impact.csv",    True),
    "predictions": ("predictions_raw.csv", False),
}

GEO_STORE: dict[str, Optional[pd.DataFrame]] = {}
GEO_ERRORS: dict[str, str] = {}


# ── geo data loading ─────────────────────────────────────────────────────────
def load_geo() -> None:
    GEO_STORE.clear()
    GEO_ERRORS.clear()
    for key, (filename, _required) in GEO_FILES.items():
        path = GEO_DIR / filename
        if not path.exists():
            GEO_STORE[key] = None
            GEO_ERRORS[key] = f"Plik nie istnieje: {path}"
            continue
        try:
            GEO_STORE[key] = pd.read_csv(path)
        except Exception as exc:
            GEO_STORE[key] = None
            GEO_ERRORS[key] = f"Błąd odczytu {path}: {exc}"


def get_df(key: str) -> pd.DataFrame:
    df = GEO_STORE.get(key)
    if df is None:
        filename = GEO_FILES[key][0]
        reason = GEO_ERRORS.get(key, "nie wczytano")
        raise HTTPException(status_code=500, detail=f"Brak danych dla '{key}' ({filename}): {reason}")
    return df


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_geo()
    yield


# ── app ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="LOTAMS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── coercion helpers ──────────────────────────────────────────────────────────
def _isna(v: Any) -> bool:
    try:
        return pd.isna(v)
    except (ValueError, TypeError):
        return False


def to_str(v: Any) -> Optional[str]:
    if v is None or _isna(v):
        return None
    return str(v).strip()


def to_float(v: Any) -> Optional[float]:
    if v is None or _isna(v):
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def to_int(v: Any) -> Optional[int]:
    f = to_float(v)
    return int(round(f)) if f is not None else None


def to_list(v: Any) -> list[str]:
    if v is None or _isna(v):
        return []
    return [part.strip() for part in str(v).split(",") if part.strip()]


def days_from_today(iso_date: Any) -> Optional[int]:
    d = to_str(iso_date)
    if not d:
        return None
    try:
        parsed = pd.to_datetime(d).date()
    except (ValueError, TypeError):
        return None
    return (parsed - date.today()).days


# ── aircraft helpers ──────────────────────────────────────────────────────────
def quarter_to_days(forecast: str) -> int:
    try:
        q, year = forecast.strip().split()
        month, day = QUARTER_MIDPOINTS[q]
        target = date(int(year), month, day)
        return (target - REF_DATE).days
    except Exception:
        return 999


def days_to_priority(days: int) -> str:
    if days <= 180:
        return "NOW"
    if days <= 360:
        return "6M"
    if days <= 540:
        return "12M"
    return "FAR"


def load_aircraft():
    df = pd.read_csv(LEADS_PATH, dtype=str)
    records = []
    for _, row in df.iterrows():
        reg = row["Rejestracja"].strip()
        op = row["Operator"].strip()
        age = int(row["Wiek"])
        last_gap_label = row["Ostatnie okno"].strip()
        dur_str = row["Czas trwania"].strip()
        dur_days = int(dur_str.replace(" dni", "").replace("dni", "").strip())
        check_type = row["Typ checku"].strip()
        forecast = row["Prognoza C-check"].strip()
        days_remaining = quarter_to_days(forecast)
        priority = days_to_priority(days_remaining)

        seed = sum(ord(c) for c in reg)
        fh_month = 280 + (seed % 80) - age * 2
        fh_month = max(180, min(360, fh_month))
        cycles = fh_month // 2 + (seed % 30)

        records.append({
            "registration": reg,
            "operator": op,
            "age": age,
            "lastGapDateLabel": last_gap_label,
            "lastGapDays": dur_days,
            "checkType": check_type,
            "predictedCCheck": forecast,
            "daysRemaining": days_remaining,
            "priority": priority,
            "flightHoursMonth": fh_month,
            "cycles": cycles,
            "confidence": 0.85 + (seed % 10) * 0.01,
            "winterSeason": False,
        })

    records.sort(key=lambda r: r["daysRemaining"])
    return records


# ── aircraft endpoints ────────────────────────────────────────────────────────
@app.get("/api/aircraft")
def get_aircraft():
    return load_aircraft()


@app.get("/api/stats")
def get_stats():
    aircraft = load_aircraft()
    now_count     = sum(1 for a in aircraft if a["priority"] == "NOW")
    observe_count = sum(1 for a in aircraft if a["priority"] in ("6M", "12M"))
    return {
        "total_fleet": len(aircraft),
        "now_count": now_count,
        "observe_count": observe_count,
    }


# ── radar / geo endpoints ─────────────────────────────────────────────────────
@app.get("/api/health")
def health() -> dict[str, Any]:
    rows = {k: (None if GEO_STORE.get(k) is None else int(len(GEO_STORE[k]))) for k in GEO_FILES}
    return {"status": "ok", "rows": rows}


@app.get("/api/radar/airspaces")
def airspaces() -> list[dict[str, Any]]:
    df = get_df("airspaces")
    out = []
    for r in df.to_dict(orient="records"):
        severity = to_str(r.get("severity"))
        color = to_str(r.get("color")) or SEVERITY_COLORS.get(severity, "#6B7280")
        out.append({
            "airspace_id":        to_str(r.get("airspace_id")),
            "name":               to_str(r.get("name")),
            "status":             to_str(r.get("status")),
            "reason":             to_str(r.get("reason")),
            "closed_since":       to_str(r.get("closed_since")),
            "closed_until":       to_str(r.get("closed_until")),
            "notam_ref":          to_str(r.get("notam_ref")),
            "severity":           severity,
            "affected_operators": to_list(r.get("affected_operators")),
            "bbox": {
                "north": to_float(r.get("bbox_north")),
                "south": to_float(r.get("bbox_south")),
                "west":  to_float(r.get("bbox_west")),
                "east":  to_float(r.get("bbox_east")),
            },
            "color": color,
        })
    return out


def _derive_trend(delta: Optional[float]) -> str:
    if delta is None:
        return "stable"
    if delta > 2:
        return "up"
    if delta < -2:
        return "down"
    return "stable"


@app.get("/api/radar/airports")
def airports() -> list[dict[str, Any]]:
    df = get_df("airports")
    out = []
    for r in df.to_dict(orient="records"):
        delta = to_float(r.get("traffic_delta_pct"))
        out.append({
            "icao":                 to_str(r.get("icao")),
            "iata":                 to_str(r.get("iata")),
            "name":                 to_str(r.get("name")),
            "city":                 to_str(r.get("city")),
            "country":              to_str(r.get("country")),
            "lat":                  to_float(r.get("lat")),
            "lon":                  to_float(r.get("lon")),
            "traffic_delta_pct":    delta,
            "trend":                _derive_trend(delta),
            "baseline_flights_day": to_int(r.get("baseline_flights_day")),
            "current_flights_day":  to_int(r.get("current_flights_day")),
            "top_operators":        to_list(r.get("top_operators")),
            "reason":               to_str(r.get("reason")),
        })
    return out


EXTRA_AIRPORT_COORDS: dict[str, tuple[float, float]] = {
    "LLBG": (32.0114, 34.8867),   # Tel Awiw Ben Gurion
    "UBBB": (40.4675, 50.0467),   # Baku Heydar Aliyev
    "RJAA": (35.7653, 140.3864),  # Tokio Narita
    "RJTT": (35.5494, 139.7798),  # Tokio Haneda
    "RKSI": (37.4691, 126.4510),  # Seul Incheon
    "OMDB": (25.2532, 55.3657),   # Dubaj International
    "OJAI": (31.7226, 35.9932),   # Amman Queen Alia
    "HESH": (27.9773, 34.3950),   # Szarm el-Szejk
    "ZBAA": (40.0799, 116.6031),  # Pekin Capital
}

def _airport_coords() -> dict[str, dict[str, Optional[float]]]:
    coords: dict[str, dict[str, Optional[float]]] = {
        icao: {"lat": lat, "lon": lon}
        for icao, (lat, lon) in EXTRA_AIRPORT_COORDS.items()
    }
    df = GEO_STORE.get("airports")
    if df is not None:
        for r in df.to_dict(orient="records"):
            icao = to_str(r.get("icao"))
            if icao:
                coords[icao] = {"lat": to_float(r.get("lat")), "lon": to_float(r.get("lon"))}
    return coords


@app.get("/api/radar/routes")
def routes() -> list[dict[str, Any]]:
    df = get_df("routes")
    coords = _airport_coords()
    out = []
    for r in df.to_dict(orient="records"):
        old_fh = to_float(r.get("old_flight_hours"))
        new_fh = to_float(r.get("new_flight_hours"))
        delta  = to_float(r.get("delta_fh_per_flight"))
        if delta is None and old_fh is not None and new_fh is not None:
            delta = round(new_fh - old_fh, 2)
        freq  = to_int(r.get("frequency_weekly"))
        extra = to_float(r.get("extra_fh_monthly"))
        if extra is None and delta is not None and freq is not None:
            extra = round(delta * freq * 4.33, 2)

        origin_icao = to_str(r.get("origin_icao"))
        dest_icao   = to_str(r.get("dest_icao"))
        o_coord = coords.get(origin_icao, {})
        d_coord = coords.get(dest_icao, {})
        out.append({
            "route_id": to_str(r.get("route_id")),
            "operator": to_str(r.get("operator")),
            "origin": {
                "icao": origin_icao,
                "name": to_str(r.get("origin_name")),
                "lat":  o_coord.get("lat"),
                "lon":  o_coord.get("lon"),
            },
            "destination": {
                "icao": dest_icao,
                "name": to_str(r.get("dest_name")),
                "lat":  d_coord.get("lat"),
                "lon":  d_coord.get("lon"),
            },
            "airspace_affected":       to_str(r.get("airspace_affected")),
            "old_flight_hours":        old_fh,
            "new_flight_hours":        new_fh,
            "delta_fh_per_flight":     delta,
            "frequency_weekly":        freq,
            "extra_fh_monthly":        extra,
            "old_route_desc":          to_str(r.get("old_route_desc")),
            "new_route_desc":          to_str(r.get("new_route_desc")),
            "ccheck_acceleration_days": to_int(r.get("ccheck_acceleration_days")),
            "active_since":            to_str(r.get("active_since")),
        })
    return out


def _route_labels() -> dict[str, str]:
    df = GEO_STORE.get("routes")
    if df is None:
        return {}
    labels = {}
    for r in df.to_dict(orient="records"):
        rid = to_str(r.get("route_id"))
        if not rid:
            continue
        origin = to_str(r.get("origin_name")) or to_str(r.get("origin_icao")) or "?"
        dest   = to_str(r.get("dest_name"))   or to_str(r.get("dest_icao"))   or "?"
        labels[rid] = f"{origin} → {dest}"
    return labels


def _leads_registrations() -> set[str]:
    if not LEADS_PATH.exists():
        return set()
    df = pd.read_csv(LEADS_PATH, dtype=str)
    return {r.strip() for r in df["Rejestracja"]}


@app.get("/api/radar/impact")
def impact(
    operator: Optional[str] = Query(default=None),
    min_acceleration: Optional[int] = Query(default=None),
    registration: Optional[str] = Query(default=None),
) -> list[dict[str, Any]]:
    df = get_df("impact")
    known_regs = _leads_registrations()
    df = df[df["registration"].str.strip().isin(known_regs)]
    labels = _route_labels()
    out = []
    for r in df.to_dict(orient="records"):
        op    = to_str(r.get("operator"))
        accel = to_int(r.get("ccheck_acceleration_days"))
        reg   = to_str(r.get("registration"))

        if operator is not None and (op or "").lower() != operator.lower():
            continue
        if min_acceleration is not None and (accel is None or accel < min_acceleration):
            continue
        if registration is not None and (reg or "").lower() != registration.lower():
            continue

        route_id = to_str(r.get("route_id"))
        label = labels.get(route_id)
        if label is None:
            o, d = to_str(r.get("origin_icao")), to_str(r.get("dest_icao"))
            label = f"{o} → {d}" if o and d else (o or d)

        out.append({
            "registration":             to_str(r.get("registration")),
            "operator":                 op,
            "route_id":                 route_id,
            "route_label":              label,
            "airspace_affected":        to_str(r.get("airspace_affected")),
            "extra_fh_monthly":         to_float(r.get("extra_fh_monthly")),
            "ccheck_acceleration_days": accel,
            "original_predicted_date":  to_str(r.get("original_predicted_date")),
            "adjusted_predicted_date":  to_str(r.get("adjusted_predicted_date")),
            "original_days_from_today": days_from_today(r.get("original_predicted_date")),
            "adjusted_days_from_today": days_from_today(r.get("adjusted_predicted_date")),
            "age_years":                to_float(r.get("age_years")),
            "last_check_window":        to_str(r.get("last_check_window")),
        })
    return out


# ── CAMO ML risk report endpoints ────────────────────────────────────────────
@app.get("/api/camo/risk-report")
def camo_risk_report() -> list[dict[str, Any]]:
    if not RISK_REPORT_PATH.exists():
        raise HTTPException(status_code=404, detail=f"Risk report not found: {RISK_REPORT_PATH}")
    df = pd.read_csv(RISK_REPORT_PATH)
    out = []
    for _, row in df.iterrows():
        out.append({
            "part":                to_str(row.get("Part")),
            "system":              to_str(row.get("System")),
            "ata_chapter":         to_int(row.get("ATA Chapter")),
            "corrosion_risk":      to_int(row.get("Corrosion Risk")),
            "damage_probability":  to_float(row.get("Damage Probability (%)")),
            "predicted_severity":  to_str(row.get("Predicted Severity")),
            "rul_fh":              to_int(row.get("Est. RUL (FH)")),
            "priority":            to_str(row.get("Priority")),
        })
    return out


@app.get("/api/camo/ml-metrics")
def camo_ml_metrics() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for task_key, path in METRICS_PATHS.items():
        if not path.exists():
            result[task_key] = []
            continue
        df = pd.read_csv(path)
        result[task_key] = df.to_dict(orient="records")
    return result
