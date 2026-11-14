"""Write web/public/data/v1/{country}/index.json and regions/{id}.json (see docs/wiki/data-contract.md)."""

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


def export_country(country: str, country_name: str, regions: list[dict], meta: dict) -> Path:
    """regions: list of {'entry': index entry, 'detail': regions/{id}.json body}."""
    out = WEB_DATA / country.lower()
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated,
        "country": country,
        "country_name": country_name,
        "period": {"start": "2000-11", "end": "2025-12"},
        "units": UNITS,
        **meta,
        "regions": [r["entry"] for r in regions],
    }
    write_json(out / "index.json", index)
    for r in regions:
        body = {"schema_version": SCHEMA_VERSION, "generated_at": generated, "units": UNITS, **r["detail"]}
        write_json(out / "regions" / f"{r['entry']['id']}.json", body)
    return out
