"""Region geometry and point-in-polygon assignment (see docs/wiki/boundaries.md).

Greece: GISCO NUTS 2024 (EPSG:4326), 1:1M for assignment, 1:20M for the web.
  https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_{01M|20M}_2024_4326_LEVL_{2|3}.geojson
Argentina: IGN provinces, WFS layer ign:provincia as a zipped shapefile:
  https://wms.ign.gob.ar/geoserver/ign/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ign%3Aprovincia&outputFormat=SHAPE-ZIP
  unzipped into data/raw/boundaries/ign_provincia/.
Files live in data/raw/boundaries/.
"""

import geopandas as gpd
import pandas as pd

from load import ROOT

BOUNDS = ROOT / "data" / "raw" / "boundaries"
NEAREST_MAX_M = 5_000  # coastal detections just outside the coastline
GRID = 1000  # dedup detection coordinates on a 0.001 deg grid before the join
LON_OFFSET = 500_000  # keeps the packed key's longitude part non-negative


def nuts(level: int, scale: str = "01M", cntr: str = "EL") -> gpd.GeoDataFrame:
    g = gpd.read_file(BOUNDS / f"NUTS_RG_{scale}_2024_4326_LEVL_{level}.geojson")
    g = g[g["CNTR_CODE"] == cntr]
    return g.rename(columns={"NUTS_ID": "id", "NAME_LATN": "name"})[["id", "name", "geometry"]].reset_index(drop=True)


def ign_provinces() -> gpd.GeoDataFrame:
    """id = `in1`, name = `nam`; clipped to latitude > -56 (drops the Antarctic sector)."""
    shp = next((BOUNDS / "ign_provincia").glob("*.shp"))
    g = gpd.read_file(shp).to_crs("EPSG:4326")
    g = g.rename(columns={"in1": "id", "nam": "name"})[["id", "name", "geometry"]]
    g["geometry"] = g.geometry.clip_by_rect(-75, -56, -53, -21)
    return g[~g.geometry.is_empty].reset_index(drop=True)


def region_table(country: str) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """(assignment polygons, web polygons) for the fitting level."""
    if country == "GR":
        return nuts(2, "01M"), nuts(2, "20M")
    if country == "AR":
        fine = ign_provinces()
        fine["geometry"] = fine.geometry.simplify(0.001)
        web = fine.copy()
        web["geometry"] = web.geometry.simplify(0.02)
        return fine, web
    raise NotImplementedError(country)


AREA_CRS = "EPSG:6933"  # WGS 84 / NSIDC EASE-Grid 2.0 Global, cylindrical equal-area


def region_areas(polys: gpd.GeoDataFrame) -> dict[str, float]:
    """Area in km2 per region id from the assignment polygons, in an equal-area CRS.
    Argentina 94 includes the Malvinas, as in the IGN layer."""
    a = polys.to_crs(AREA_CRS).area / 1e6
    return {i: round(float(v), 1) for i, v in zip(polys["id"], a)}


def assign(det: pd.DataFrame, polys: gpd.GeoDataFrame) -> tuple[pd.Series, dict]:
    """Region id per detection: within, then nearest within NEAREST_MAX_M, else None.
    Coordinates are deduplicated on a 0.001 deg (~100 m) grid first; the detection
    position uncertainty (375 m to 1 km pixels) is larger."""
    lat_i = (det["latitude"] * GRID).round().astype("int64")
    lon_i = (det["longitude"] * GRID).round().astype("int64") + LON_OFFSET
    key = lat_i * 10_000_000 + lon_i
    uniq = pd.Series(key.unique())
    lat = (uniq // 10_000_000) / GRID
    lon = (uniq % 10_000_000 - LON_OFFSET) / GRID
    region_u, n_near = _assign_points(lon, lat, polys)
    region = key.map(pd.Series(region_u.to_numpy(), index=uniq.to_numpy()))
    stats = {"unique_points": int(len(uniq)), "nearest_points": n_near,
             "assigned": int(region.notna().sum()), "unassigned": int(region.isna().sum())}
    return region, stats


def clip_to_country(df: pd.DataFrame, country: str) -> pd.DataFrame:
    """Rows that assign() places in a region of `country` (inside, or <= NEAREST_MAX_M from it).
    Used for the 2026 bounding-box API files, which also hold neighbouring countries."""
    polys, _ = region_table(country)
    region, _ = assign(df, polys)
    return df[region.notna().to_numpy()].reset_index(drop=True)


def _assign_points(lon: pd.Series, lat: pd.Series, polys: gpd.GeoDataFrame) -> tuple[pd.Series, int]:
    pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(lon, lat), crs="EPSG:4326")
    j = gpd.sjoin(pts, polys, how="left", predicate="within")
    j = j[~j.index.duplicated()]
    region = j["id"].copy()
    miss = region.isna()
    n_near = 0
    if miss.any():
        crs = pts.estimate_utm_crs()
        near = gpd.sjoin_nearest(pts[miss].to_crs(crs), polys.to_crs(crs), how="left",
                                 max_distance=NEAREST_MAX_M)
        near = near[~near.index.duplicated()]
        region.loc[near.index] = near["id"]
        n_near = int(near["id"].notna().sum())
    return region, n_near
