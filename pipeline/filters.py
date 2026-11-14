"""Static-source filter: drop a 0.01 deg cell for a sensor and year when it has
detections on >= MIN_DAYS distinct days in that year (gas flares, industry, volcanoes)."""

import pandas as pd

MIN_DAYS = 16


def static_cells(df: pd.DataFrame, min_days: int = MIN_DAYS) -> pd.DataFrame:
    """Return (sensor, year, cell, days, n) for cells flagged static."""
    g = df.groupby(["sensor", "year", "cell"]).agg(days=("acq_date", "nunique"), n=("acq_date", "size"))
    return g[g["days"] >= min_days].reset_index()


def drop_static(df: pd.DataFrame, min_days: int = MIN_DAYS) -> tuple[pd.DataFrame, pd.DataFrame]:
    flagged = static_cells(df, min_days)
    key = ["sensor", "year", "cell"]
    marked = df.merge(flagged[key].assign(_static=True), on=key, how="left")
    keep = marked["_static"].isna()
    return df[keep.to_numpy()].reset_index(drop=True), flagged
