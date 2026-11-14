"""Hotspot-level CSV: the individual FIRMS detections behind the monthly counts.

Usage: uv run python pipeline/hotspots.py --country GR
Writes web/public/data/v1/{country}/detections/{id}.csv for the country and every region
(see docs/wiki/data-contract.md). Same input, type filter, static-source filter and region
assignment as build.py, so the rows add up to the `modis` and `viirs` monthly counts.
Argentina (4.5 M rows) is not exported: too large for static hosting.
"""

import argparse
import csv
from pathlib import Path

import pandas as pd

from export import WEB_DATA
from filters import drop_static
from load import COUNTRIES, USECOLS, cell_key, read_csvs
from regions import assign, region_table

FIELDS = ["region_id", "sensor", "satellite", "acq_date", "acq_time", "daynight",
          "latitude", "longitude", "frp", "confidence", "version", "provisional"]
EXPORTED = ("GR",)


def detections(country: str) -> pd.DataFrame:
    """Filtered detections with their region (NaN when outside every region polygon), sorted by time."""
    df = read_csvs(country, usecols=[*USECOLS, "acq_time", "confidence"])
    df = df[df["type"] == 0].copy()
    df["acq_date"] = pd.to_datetime(df["acq_date"])
    df["year"] = df["acq_date"].dt.year.astype("int16")
    df["cell"] = cell_key(df["latitude"], df["longitude"])
    kept, _ = drop_static(df)
    polys, _ = region_table(country)
    kept["region_id"], stats = assign(kept, polys)
    print("assignment:", stats)
    kept["acq_date"] = kept["acq_date"].dt.strftime("%Y-%m-%d")
    kept["acq_time"] = kept["acq_time"].str.zfill(4)
    kept["provisional"] = kept["provisional"].map({True: "true", False: "false"})
    return kept.sort_values(["acq_date", "acq_time", "sensor", "latitude", "longitude"]).reset_index(drop=True)


def write(path: Path, rows: pd.DataFrame, region_id: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = rows.assign(region_id=region_id)[FIELDS]
    out.to_csv(path, index=False, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", default="GR", choices=list(EXPORTED))
    c = ap.parse_args().country
    det = detections(c)
    dest = WEB_DATA / c.lower() / "detections"
    write(dest / f"{c}.csv", det, c)  # all rows, as the national counts include unassigned ones
    for rid, sub in det.groupby("region_id"):
        write(dest / f"{rid}.csv", sub, rid)
    size = sum(p.stat().st_size for p in dest.glob("*.csv"))
    print(f"{COUNTRIES[c]}: {len(det)} detections ({det['region_id'].isna().sum()} outside regions), "
          f"{det['region_id'].nunique()} regions, "
          f"{size / 1e6:.1f} MB in {dest}")


if __name__ == "__main__":
    main()
