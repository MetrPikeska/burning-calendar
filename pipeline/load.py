"""Load FIRMS country CSVs into one detection table per country.

Keeps `type == 0` (presumed vegetation fire). Output columns:
sensor (modis | viirs), satellite (Terra | Aqua | N), acq_date, ym, year, month,
daynight (D | N), latitude, longitude, cell (0.01 deg key), version, frp, provisional.

2026 comes from the FIRMS area API (download_firms_api.py): bounding-box files in
data/raw/firms/api/, clipped here to the country polygons (within or <= 5 km, as
regions.assign). NRT rows (provisional = True) carry no `type`; they get type 2 when their
0.01 deg cell (VIIRS) or 3x3 cell block (MODIS) had a non-zero type in the SP record of
2023-2026 for the same sensor, else 0.
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
DTYPES = {"satellite": str, "version": str, "acq_time": str, "confidence": str}
API_KINDS = ("sp", "nrt")
NRT_MASK_YEARS = range(2023, 2027)
NRT_MASK_DILATE = {"viirs": 0, "modis": 1}  # cells around a static cell also masked (MODIS pixel ~1 km)


def cell_key(lat: pd.Series, lon: pd.Series) -> pd.Series:
    """0.01 degree cell id as int64: floor(lat*100) * 100000 + floor(lon*100)."""
    ilat = np.floor(lat.to_numpy() * 100).astype(np.int64)
    ilon = np.floor(lon.to_numpy() * 100).astype(np.int64)
    return pd.Series(ilat * 100_000 + ilon, index=lat.index)


def dilate(cells, k: int) -> set:
    """Cell ids plus their neighbours within k cells (0.01 deg) in both directions."""
    cells = set(int(c) for c in cells)
    if k == 0:
        return cells
    return {c + dl * 100_000 + dn for c in cells for dl in range(-k, k + 1) for dn in range(-k, k + 1)}


def fill_nrt_type(df: pd.DataFrame) -> pd.DataFrame:
    """Set `type` of NRT rows from the static cells seen in the SP record (see module doc)."""
    df = df.copy()
    years = df["acq_date"].astype(str).str[:4].astype(int)
    for sensor, k in NRT_MASK_DILATE.items():
        is_s = df["sensor"] == sensor
        ref = df[is_s & ~df["provisional"] & years.isin(NRT_MASK_YEARS) & df["type"].notna() & (df["type"] != 0)]
        static = dilate(cell_key(ref["latitude"], ref["longitude"]).unique(), k)
        sel = is_s & df["provisional"] & df["type"].isna()
        cells = cell_key(df.loc[sel, "latitude"], df.loc[sel, "longitude"])
        df.loc[sel, "type"] = np.where(cells.isin(static), 2, 0)
    df["type"] = df["type"].astype("int64")
    return df


def read_csvs(country: str, raw_dir: Path = RAW, usecols: list[str] = USECOLS) -> pd.DataFrame:
    """Country CSVs (2000-2025) plus the clipped 2026 API files, with `provisional` and NRT `type` filled."""
    from regions import clip_to_country  # local: regions imports load

    name = COUNTRIES[country]
    frames = []
    for sensor, prefix in SENSOR_PREFIX.items():
        for path in sorted(raw_dir.glob(f"{prefix}_*_{name}.csv")):
            df = pd.read_csv(path, usecols=usecols, dtype=DTYPES)
            df["sensor"] = sensor
            df["provisional"] = False
            frames.append(df)
        for kind in API_KINDS:
            for path in sorted((raw_dir / "api").glob(f"{prefix}-{kind}_*_{name}.csv")):
                df = pd.read_csv(path, usecols=lambda c: c in usecols, dtype=DTYPES)
                if df.empty:
                    continue
                if "type" not in df:
                    df["type"] = np.nan
                df["sensor"] = sensor
                df["provisional"] = kind == "nrt"
                frames.append(clip_to_country(df, country))
    if not frames:
        raise FileNotFoundError(f"no CSVs for {name} in {raw_dir}")
    return fill_nrt_type(pd.concat(frames, ignore_index=True))


def tidy(df: pd.DataFrame) -> pd.DataFrame:
    df = df[df["type"] == 0].copy()
    df["acq_date"] = pd.to_datetime(df["acq_date"])
    df["year"] = df["acq_date"].dt.year.astype("int16")
    df["month"] = df["acq_date"].dt.month.astype("int8")
    df["ym"] = df["acq_date"].dt.strftime("%Y-%m")
    df["cell"] = cell_key(df["latitude"], df["longitude"])
    cols = ["sensor", "satellite", "acq_date", "ym", "year", "month", "daynight",
            "latitude", "longitude", "cell", "version", "frp", "provisional"]
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
