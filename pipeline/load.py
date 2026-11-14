"""Load FIRMS country CSVs into one detection table per country.

Keeps `type == 0` (presumed vegetation fire). Output columns:
sensor (modis | viirs), satellite (Terra | Aqua | N), acq_date, ym, year, month,
daynight (D | N), latitude, longitude, cell (0.01 deg key), version, frp.
"""

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "firms"
INTERIM = ROOT / "data" / "interim"

COUNTRIES = {"GR": "Greece", "AR": "Argentina"}
SENSOR_PREFIX = {"modis": "modis", "viirs": "viirs-snpp"}
USECOLS = ["latitude", "longitude", "acq_date", "satellite", "version", "frp", "daynight", "type"]


def cell_key(lat: pd.Series, lon: pd.Series) -> pd.Series:
    """0.01 degree cell id as int64: floor(lat*100) * 100000 + floor(lon*100)."""
    ilat = np.floor(lat.to_numpy() * 100).astype(np.int64)
    ilon = np.floor(lon.to_numpy() * 100).astype(np.int64)
    return pd.Series(ilat * 100_000 + ilon, index=lat.index)


def read_csvs(country: str, raw_dir: Path = RAW) -> pd.DataFrame:
    name = COUNTRIES[country]
    frames = []
    for sensor, prefix in SENSOR_PREFIX.items():
        for path in sorted(raw_dir.glob(f"{prefix}_*_{name}.csv")):
            df = pd.read_csv(path, usecols=USECOLS, dtype={"satellite": str, "version": str})
            df["sensor"] = sensor
            frames.append(df)
    if not frames:
        raise FileNotFoundError(f"no CSVs for {name} in {raw_dir}")
    return pd.concat(frames, ignore_index=True)


def tidy(df: pd.DataFrame) -> pd.DataFrame:
    df = df[df["type"] == 0].copy()
    df["acq_date"] = pd.to_datetime(df["acq_date"])
    df["year"] = df["acq_date"].dt.year.astype("int16")
    df["month"] = df["acq_date"].dt.month.astype("int8")
    df["ym"] = df["acq_date"].dt.strftime("%Y-%m")
    df["cell"] = cell_key(df["latitude"], df["longitude"])
    cols = ["sensor", "satellite", "acq_date", "ym", "year", "month", "daynight",
            "latitude", "longitude", "cell", "version", "frp"]
    return df[cols].reset_index(drop=True)


def load(country: str, refresh: bool = False) -> pd.DataFrame:
    out = INTERIM / f"{country.lower()}_detections.parquet"
    if out.exists() and not refresh:
        return pd.read_parquet(out)
    df = tidy(read_csvs(country))
    INTERIM.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False)
    return df


if __name__ == "__main__":
    import sys

    c = sys.argv[1] if len(sys.argv) > 1 else "GR"
    d = load(c, refresh=True)
    print(d.groupby(["sensor", "satellite", "daynight"]).size())
    print(d.groupby(["sensor", "version"])["year"].agg(["min", "max", "size"]))
