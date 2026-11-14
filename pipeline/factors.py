"""Context factors per region and month: fire weather (FWI), drought (SPEI) and land cover.

These are context for the calendar, not model inputs: the app shows them next to the anomaly of
the detections. Nothing here changes harmonization or anomalies.

Inputs, all gridded and downloaded by download_factors.py into data/raw/factors/:
  fwi_*.nc      daily Fire Weather Index (CEMS fire danger indices, ERA5-based, 0.25 deg)
  spei03.nc     SPEIbase monthly SPEI-3 (0.5 deg), spei06.nc SPEI-6
  clc_*.gpkg    CORINE Land Cover polygons with a `Code_18` column

Region values are the mean over the grid cells whose centre lies inside the region polygon. A region
with no cell centre inside takes the one cell nearest to its representative point and is flagged
through `n_cells == 1`.
"""

from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import xarray as xr

FWI_ELEVATED_PCT = 75.0  # percentile of the same calendar month over all years
FWI_CRITICAL_PCT = 90.0
SPEI_DRY = -1.0
SPEI_WET = 1.0
MIN_YEARS_FOR_PCT = 10

# CORINE level 3 codes grouped for the context panel.
CROPLAND = {211, 212, 213, 221, 222, 223, 241, 242, 243, 244}
TREE = {311, 312, 313}
SHRUB_GRASS = {231, 321, 322, 323, 324}


def cell_index(lons: np.ndarray, lats: np.ndarray, polys: gpd.GeoDataFrame) -> dict[str, np.ndarray]:
    """Flat cell indices (row-major over lat, lon) per region id.

    A cell belongs to a region when its centre lies inside the polygon; a region without any such
    cell gets the cell nearest to its representative point.
    """
    lon2, lat2 = np.meshgrid(lons, lats)
    pts = gpd.GeoDataFrame({"flat": np.arange(lon2.size)},
                           geometry=gpd.points_from_xy(lon2.ravel(), lat2.ravel()), crs="EPSG:4326")
    joined = gpd.sjoin(pts, polys[["id", "geometry"]], how="inner", predicate="within")
    out = {rid: g["flat"].to_numpy() for rid, g in joined.groupby("id")}
    for rid, geom in zip(polys["id"], polys.geometry):
        if rid in out:
            continue
        p = geom.representative_point()
        d = (lon2.ravel() - p.x) ** 2 + (lat2.ravel() - p.y) ** 2
        out[rid] = np.array([int(np.argmin(d))])
    return out


def _spatial_mean(da: xr.DataArray, idx: np.ndarray) -> pd.Series:
    """Mean over the flat cell indices for every time step (NaN-aware)."""
    flat = da.transpose("time", "latitude", "longitude").to_numpy().reshape(da.sizes["time"], -1)
    return pd.Series(np.nanmean(flat[:, idx], axis=1), index=pd.DatetimeIndex(da["time"].to_numpy()))


def monthly_by_region(da: xr.DataArray, cells: dict[str, np.ndarray], agg: str = "mean") -> pd.DataFrame:
    """Rows `YYYY-MM`, one column per region id. `agg` over days within a month: mean or max."""
    cols = {}
    for rid, idx in cells.items():
        s = _spatial_mean(da, idx)
        g = s.groupby(s.index.strftime("%Y-%m"))
        cols[rid] = g.max() if agg == "max" else g.mean()
    return pd.DataFrame(cols)


def percentile_by_calendar_month(series: pd.Series) -> pd.Series:
    """Percentile rank (0-100) of each month among the same calendar month over all years.
    NaN for calendar months with fewer than MIN_YEARS_FOR_PCT values."""
    out = pd.Series(np.nan, index=series.index, dtype=float)
    month = pd.Series(series.index.str[5:7], index=series.index)
    for _, idx in month.groupby(month).groups.items():
        vals = series.loc[idx]
        ok = vals.notna()
        if ok.sum() < MIN_YEARS_FOR_PCT:
            continue
        ranks = vals[ok].rank(pct=True, method="average") * 100
        out.loc[ranks.index] = ranks
    return out


def fwi_level(pct: float | None) -> str | None:
    if pct is None or pd.isna(pct):
        return None
    if pct >= FWI_CRITICAL_PCT:
        return "critical"
    if pct >= FWI_ELEVATED_PCT:
        return "elevated"
    return "normal"


def spei_level(v: float | None) -> str | None:
    if v is None or pd.isna(v):
        return None
    if v <= SPEI_DRY:
        return "dry"
    if v >= SPEI_WET:
        return "wet"
    return "normal"


def context_months(yms: pd.Index, fwi: pd.Series | None, spei3: pd.Series | None,
                   spei6: pd.Series | None) -> pd.DataFrame:
    """Per-month context columns for one region, indexed by `yms`; a missing input gives null columns.
    Columns: fwi, fwi_pct, fwi_level, spei3, spei6, spei3_level, spei6_level."""
    out = pd.DataFrame(index=yms)
    f = fwi.reindex(yms) if fwi is not None else pd.Series(np.nan, index=yms)
    out["fwi"] = f.round(2)
    pct = percentile_by_calendar_month(f)
    out["fwi_pct"] = pct.round(1)
    out["fwi_level"] = [fwi_level(p) for p in pct]
    for name, s in (("spei3", spei3), ("spei6", spei6)):
        v = s.reindex(yms) if s is not None else pd.Series(np.nan, index=yms)
        out[name] = v.round(2)
        out[f"{name}_level"] = [spei_level(x) for x in v]
    return out


def landcover_shares(clc: gpd.GeoDataFrame, polys: gpd.GeoDataFrame, code_col: str = "Code_18") -> pd.DataFrame:
    """Area share (%) of cropland, tree cover and shrub or grass per region, of the region's total area.

    Both layers are overlaid in an equal-area CRS (EPSG:6933). The remaining share (artificial,
    wetland, water, bare) is `other_pct`.
    """
    crs = "EPSG:6933"
    p = polys[["id", "geometry"]].to_crs(crs)
    c = clc[[code_col, "geometry"]].to_crs(crs)
    c = c.assign(code=pd.to_numeric(c[code_col], errors="coerce"))
    inter = gpd.overlay(c[["code", "geometry"]], p, how="intersection", keep_geom_type=True)
    inter["area"] = inter.geometry.area
    total = p.set_index("id").geometry.area
    rows = []
    for rid, g in inter.groupby("id"):
        a = lambda codes: float(g.loc[g["code"].isin(codes), "area"].sum())  # noqa: E731
        crop, tree, shrub = a(CROPLAND), a(TREE), a(SHRUB_GRASS)
        t = float(total[rid])
        rows.append({"region_id": rid, "cropland_pct": 100 * crop / t, "tree_pct": 100 * tree / t,
                     "shrub_grass_pct": 100 * shrub / t,
                     "other_pct": 100 * max(t - crop - tree - shrub, 0.0) / t})
    return pd.DataFrame(rows).set_index("region_id").round(1)


def load_grid(path: Path | list[Path], var: str) -> xr.DataArray:
    """Open one or several NetCDF files and return `var` with dims time, latitude, longitude."""
    ds = xr.open_mfdataset(path) if isinstance(path, list) else xr.open_dataset(path)
    da = ds[var]
    rename = {k: v for k, v in {"lat": "latitude", "lon": "longitude", "valid_time": "time"}.items()
              if k in da.dims or k in da.coords}
    return da.rename(rename)


RAW = Path(__file__).resolve().parent.parent / "data" / "raw" / "factors"
SOURCES = {
    "fwi": {"name": "CEMS fire danger indices, historical (ERA5-based), Fire Weather Index, 0.25 deg, daily",
            "url": "https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1"},
    "spei": {"name": "SPEIbase (CSIC), SPEI-3 and SPEI-6, 0.5 deg, monthly",
             "url": "https://spei.csic.es/database.html"},
    "landcover": {"name": "CORINE Land Cover 2018 (Copernicus Land Monitoring Service)",
                  "url": "https://land.copernicus.eu/en/products/corine-land-cover"},
}


def _with_country(polys: gpd.GeoDataFrame, country: str) -> gpd.GeoDataFrame:
    """Region polygons plus one row for the whole country (id = country code)."""
    whole = gpd.GeoDataFrame({"id": [country], "name": [country]},
                             geometry=[polys.geometry.union_all()], crs=polys.crs)
    return pd.concat([polys[["id", "name", "geometry"]], whole], ignore_index=True)


def load_context(country: str, polys: gpd.GeoDataFrame, raw: Path = RAW) -> dict:
    """Monthly FWI and SPEI per region id plus land cover shares, from whatever files exist in `raw`.
    Missing inputs give None, and the pipeline then writes null context fields."""
    out: dict = {"fwi": None, "spei3": None, "spei6": None, "landcover": None, "sources": {}}
    regions = _with_country(polys, country)

    fwi_files = sorted(raw.glob("fwi_*.nc"))
    if fwi_files:
        da = load_grid(fwi_files, _first_var(fwi_files[0], ("fwinx", "fwi", "fire_weather_index")))
        out["fwi"] = monthly_by_region(da, cell_index(da["longitude"].to_numpy(), da["latitude"].to_numpy(), regions))
        out["sources"]["fwi"] = SOURCES["fwi"]
    for key, name in (("spei3", "spei03.nc"), ("spei6", "spei06.nc")):
        path = raw / name
        if path.exists():
            da = load_grid(path, _first_var(path, ("spei",)))
            out[key] = monthly_by_region(da, cell_index(da["longitude"].to_numpy(), da["latitude"].to_numpy(), regions))
            out["sources"]["spei"] = SOURCES["spei"]
    clc = next(iter(sorted(raw.glob("clc_*.gpkg"))), None)
    if clc is not None:
        out["landcover"] = landcover_shares(gpd.read_file(clc), regions)
        out["sources"]["landcover"] = SOURCES["landcover"]
    return out


def _first_var(path: Path, names: tuple[str, ...]) -> str:
    with xr.open_dataset(path) as ds:
        for n in names:
            if n in ds.data_vars:
                return n
        return next(iter(ds.data_vars))


def region_context(ctx: dict, rid: str, yms: pd.Index) -> tuple[pd.DataFrame, dict]:
    """(monthly columns, `context` block for regions/{id}.json) for one region."""
    pick = lambda key: ctx[key][rid] if ctx.get(key) is not None and rid in ctx[key] else None  # noqa: E731
    months = context_months(yms, pick("fwi"), pick("spei3"), pick("spei6"))
    lc = ctx.get("landcover")
    landcover = ({**lc.loc[rid].to_dict(), "source": "CORINE Land Cover 2018"}
                 if lc is not None and rid in lc.index else None)
    block = {"available": bool(months[["fwi", "spei3", "spei6"]].notna().any().any() or landcover),
             "landcover": landcover, "sources": ctx.get("sources", {})}
    return months, block
