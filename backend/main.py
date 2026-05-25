"""RADAR backend — REST API serving geopolitical airspace / route / impact data.

Run: uvicorn main:app --reload  (port 8000)
CSV files are loaded once at startup from DATA_DIR (defaults to this file's directory).
"""

import os
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Any, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent))

# filename (without .csv) -> required flag. predictions_raw is optional: geo_impact
# already carries every field the impact schema needs, so its absence is non-fatal.
CSV_FILES = {
    "airspaces": ("geo_airspaces.csv", True),
    "routes": ("geo_routes.csv", True),
    "airports": ("geo_airports.csv", True),
    "impact": ("geo_impact.csv", True),
    "predictions": ("predictions_raw.csv", False),
}

SEVERITY_COLORS = {"critical": "#DC2626", "warning": "#F59E0B"}

# in-memory store populated at startup
STORE: dict[str, Optional[pd.DataFrame]] = {}
LOAD_ERRORS: dict[str, str] = {}


# --------------------------------------------------------------------------- #
# value coercion helpers (NaN -> None / sensible default)
# --------------------------------------------------------------------------- #
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
    """Split a comma-separated cell into a trimmed list; NaN/empty -> []."""
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


# --------------------------------------------------------------------------- #
# startup / data loading
# --------------------------------------------------------------------------- #
def load_data() -> None:
    STORE.clear()
    LOAD_ERRORS.clear()
    for key, (filename, _required) in CSV_FILES.items():
        path = DATA_DIR / filename
        if not path.exists():
            STORE[key] = None
            LOAD_ERRORS[key] = f"Plik nie istnieje: {path}"
            continue
        try:
            STORE[key] = pd.read_csv(path)
        except Exception as exc:  # noqa: BLE001 - surface any parse failure
            STORE[key] = None
            LOAD_ERRORS[key] = f"Błąd odczytu {path}: {exc}"


def get_df(key: str) -> pd.DataFrame:
    df = STORE.get(key)
    if df is None:
        filename = CSV_FILES[key][0]
        reason = LOAD_ERRORS.get(key, "nie wczytano")
        raise HTTPException(
            status_code=500,
            detail=f"Brak danych dla '{key}' ({filename}): {reason}",
        )
    return df


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_data()
    yield


app = FastAPI(title="RADAR API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# endpoints
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> dict[str, Any]:
    rows = {
        key: (None if STORE.get(key) is None else int(len(STORE[key])))
        for key in CSV_FILES
    }
    return {"status": "ok", "rows": rows}


@app.get("/api/radar/airspaces")
def airspaces() -> list[dict[str, Any]]:
    df = get_df("airspaces")
    out = []
    for r in df.to_dict(orient="records"):
        severity = to_str(r.get("severity"))
        color = to_str(r.get("color")) or SEVERITY_COLORS.get(severity, "#6B7280")
        out.append(
            {
                "airspace_id": to_str(r.get("airspace_id")),
                "name": to_str(r.get("name")),
                "status": to_str(r.get("status")),
                "reason": to_str(r.get("reason")),
                "closed_since": to_str(r.get("closed_since")),
                "closed_until": to_str(r.get("closed_until")),
                "notam_ref": to_str(r.get("notam_ref")),
                "severity": severity,
                "affected_operators": to_list(r.get("affected_operators")),
                "bbox": {
                    "north": to_float(r.get("bbox_north")),
                    "south": to_float(r.get("bbox_south")),
                    "west": to_float(r.get("bbox_west")),
                    "east": to_float(r.get("bbox_east")),
                },
                "color": color,
            }
        )
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
        out.append(
            {
                "icao": to_str(r.get("icao")),
                "iata": to_str(r.get("iata")),
                "name": to_str(r.get("name")),
                "city": to_str(r.get("city")),
                "country": to_str(r.get("country")),
                "lat": to_float(r.get("lat")),
                "lon": to_float(r.get("lon")),
                "traffic_delta_pct": delta,
                "trend": _derive_trend(delta),
                "baseline_flights_day": to_int(r.get("baseline_flights_day")),
                "current_flights_day": to_int(r.get("current_flights_day")),
                "top_operators": to_list(r.get("top_operators")),
                "reason": to_str(r.get("reason")),
            }
        )
    return out


def _airport_coords() -> dict[str, dict[str, Optional[float]]]:
    """icao -> {lat, lon} lookup from the airports table (empty if unavailable)."""
    df = STORE.get("airports")
    if df is None:
        return {}
    coords = {}
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
        delta = to_float(r.get("delta_fh_per_flight"))
        if delta is None and old_fh is not None and new_fh is not None:
            delta = round(new_fh - old_fh, 2)
        freq = to_int(r.get("frequency_weekly"))
        extra = to_float(r.get("extra_fh_monthly"))
        if extra is None and delta is not None and freq is not None:
            extra = round(delta * freq * 4.33, 2)

        origin_icao = to_str(r.get("origin_icao"))
        dest_icao = to_str(r.get("dest_icao"))
        o_coord = coords.get(origin_icao, {})
        d_coord = coords.get(dest_icao, {})
        out.append(
            {
                "route_id": to_str(r.get("route_id")),
                "operator": to_str(r.get("operator")),
                "origin": {
                    "icao": origin_icao,
                    "name": to_str(r.get("origin_name")),
                    "lat": o_coord.get("lat"),
                    "lon": o_coord.get("lon"),
                },
                "destination": {
                    "icao": dest_icao,
                    "name": to_str(r.get("dest_name")),
                    "lat": d_coord.get("lat"),
                    "lon": d_coord.get("lon"),
                },
                "airspace_affected": to_str(r.get("airspace_affected")),
                "old_flight_hours": old_fh,
                "new_flight_hours": new_fh,
                "delta_fh_per_flight": delta,
                "frequency_weekly": freq,
                "extra_fh_monthly": extra,
                "old_route_desc": to_str(r.get("old_route_desc")),
                "new_route_desc": to_str(r.get("new_route_desc")),
                "ccheck_acceleration_days": to_int(r.get("ccheck_acceleration_days")),
                "active_since": to_str(r.get("active_since")),
            }
        )
    return out


def _route_labels() -> dict[str, str]:
    """route_id -> 'Origin → Destination' label from the routes table."""
    df = STORE.get("routes")
    if df is None:
        return {}
    labels = {}
    for r in df.to_dict(orient="records"):
        rid = to_str(r.get("route_id"))
        if not rid:
            continue
        origin = to_str(r.get("origin_name")) or to_str(r.get("origin_icao")) or "?"
        dest = to_str(r.get("dest_name")) or to_str(r.get("dest_icao")) or "?"
        labels[rid] = f"{origin} → {dest}"
    return labels


@app.get("/api/radar/impact")
def impact(
    operator: Optional[str] = Query(default=None),
    min_acceleration: Optional[int] = Query(default=None),
) -> list[dict[str, Any]]:
    df = get_df("impact")
    labels = _route_labels()
    out = []
    for r in df.to_dict(orient="records"):
        op = to_str(r.get("operator"))
        accel = to_int(r.get("ccheck_acceleration_days"))

        if operator is not None and (op or "").lower() != operator.lower():
            continue
        if min_acceleration is not None and (accel is None or accel < min_acceleration):
            continue

        route_id = to_str(r.get("route_id"))
        label = labels.get(route_id)
        if label is None:
            o, d = to_str(r.get("origin_icao")), to_str(r.get("dest_icao"))
            label = f"{o} → {d}" if o and d else (o or d)

        out.append(
            {
                "registration": to_str(r.get("registration")),
                "operator": op,
                "route_id": route_id,
                "route_label": label,
                "airspace_affected": to_str(r.get("airspace_affected")),
                "extra_fh_monthly": to_float(r.get("extra_fh_monthly")),
                "ccheck_acceleration_days": accel,
                "original_predicted_date": to_str(r.get("original_predicted_date")),
                "adjusted_predicted_date": to_str(r.get("adjusted_predicted_date")),
                "original_days_from_today": days_from_today(r.get("original_predicted_date")),
                "adjusted_days_from_today": days_from_today(r.get("adjusted_predicted_date")),
                "age_years": to_float(r.get("age_years")),
                "last_check_window": to_str(r.get("last_check_window")),
            }
        )
    return out
