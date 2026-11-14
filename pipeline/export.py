"""Write web/public/data/v1/{country}/index.json, regions/{id}.json and regions/{id}.csv (see docs/wiki/data-contract.md)."""

import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_DATA = ROOT / "web" / "public" / "data" / "v1"
SCHEMA_VERSION = "1"
UNITS = "VIIRS-equivalent active fire detections per month (S-NPP 375 m scale)"


def _clean(o):
    """Replace NaN with None and numpy scalars with Python types, recursively."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(v) for v in o]
    if hasattr(o, "item"):
        o = o.item()
    if isinstance(o, float) and math.isnan(o):
        return None
    return o


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_clean(obj), separators=(",", ":"), ensure_ascii=False))


CSV_FIELDS = ["ym", "modis", "viirs", "harm", "harm_lo", "harm_hi", "src", "fit_level",
              "anom_pct", "anom", "outage_days", "outage", "baseline_median", "baseline_p90", "baseline_years",
              "days_modis", "days_viirs", "outage_days_viirs", "outage_viirs", "provisional"]


def write_csv(path: Path, region_id: str, mode: str, months: list[dict]) -> None:
    """Monthly records as CSV, one row per month; empty cell = null in the JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["region_id", "mode", *CSV_FIELDS])
        for m in _clean(months):
            w.writerow([region_id, mode, *("" if m.get(k) is None else str(m[k]).lower() if isinstance(m[k], bool)
                                            else m[k] for k in CSV_FIELDS)])


def export_country(country: str, country_name: str, regions: list[dict], meta: dict) -> Path:
    """regions: list of {'entry': index entry, 'detail': regions/{id}.json body}.
    meta carries `period` ({start, end, provisional_from}) and the other header fields."""
    out = WEB_DATA / country.lower()
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated,
        "country": country,
        "country_name": country_name,
        "units": UNITS,
        **meta,
        "regions": [r["entry"] for r in regions],
    }
    write_json(out / "index.json", index)
    for r in regions:
        body = {"schema_version": SCHEMA_VERSION, "generated_at": generated, "units": UNITS, **r["detail"]}
        write_json(out / "regions" / f"{r['entry']['id']}.json", body)
        write_csv(out / "regions" / f"{r['entry']['id']}.csv", r["entry"]["id"], r["entry"]["mode"],
                  r["detail"]["months"])
    return out
