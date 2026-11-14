"""Offline basemap for the web: Natural Earth 1:50M countries around Greece and Argentina.

Source (public domain): https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip
Raw zip goes to data/raw/basemap/, output to web/public/data/base/land.geojson.
The map uses it only when OpenFreeMap is unreachable or with ?basemap=local.

    uv run python pipeline/basemap.py
"""

import json

import geopandas as gpd
import requests
from shapely.geometry import box, mapping

from load import ROOT

URL = "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip"
RAW = ROOT / "data" / "raw" / "basemap" / "ne_50m_admin_0_countries.zip"
OUT = ROOT / "web" / "public" / "data" / "base" / "land.geojson"

# Greece and Argentina with a margin (lon_min, lat_min, lon_max, lat_max).
BOXES = [box(12.0, 31.0, 34.0, 45.5), box(-80.0, -58.0, -45.0, -15.0)]
SIMPLIFY_DEG = 0.01


def download() -> None:
    if RAW.exists():
        return
    RAW.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(URL, timeout=60)
    r.raise_for_status()
    RAW.write_bytes(r.content)


def round_coords(obj, nd=3):
    if isinstance(obj, float):
        return round(obj, nd)
    if isinstance(obj, (list, tuple)):
        return [round_coords(x, nd) for x in obj]
    return obj


def main() -> None:
    download()
    world = gpd.read_file(f"zip://{RAW}")[["NAME_EN", "geometry"]]
    parts = []
    for b in BOXES:
        clip = gpd.clip(world, b)
        parts.append(clip[~clip.geometry.is_empty])
    land = gpd.pd.concat(parts, ignore_index=True)
    land["geometry"] = land.geometry.simplify(SIMPLIFY_DEG, preserve_topology=True)
    features = [
        {"type": "Feature", "properties": {"name": n}, "geometry": round_coords(mapping(g))}
        for n, g in zip(land["NAME_EN"], land.geometry)
        if g is not None and not g.is_empty
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))
    print(f"{OUT.relative_to(ROOT)}: {len(features)} features, {OUT.stat().st_size / 1024:.0f} kB")


if __name__ == "__main__":
    main()
