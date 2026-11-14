"""Region polygons for the MCP tool find_region_at (burncal-x9p).

The web map uses generalized polygons (GISCO NUTS 1:20M for Greece, IGN simplified to
0.02 deg for Argentina), but regions.assign() puts detections into the 1:1M NUTS
polygons and the IGN polygons simplified to 0.001 deg (regions.region_table). This
script writes the assignment polygons, simplified to TOLERANCE with shared borders kept
(coverage simplification), to web/public/data/v1/{gr,ar}/regions_mcp.geojson. Only
web/api/mcp.ts reads them; vercel.json already bundles public/data/** into the function.

Run: uv run python pipeline/mcp_geometry.py
"""

import geopandas as gpd

from load import ROOT
from regions import region_table

TOLERANCE = 0.001  # deg, about 100 m, the same as the Argentine assignment polygons
PRECISION = 0.0001  # deg, output grid; detection coordinates have 4 decimals
OUT = ROOT / "web" / "public" / "data" / "v1"


def mcp_polygons(country: str) -> gpd.GeoDataFrame:
    fine, _ = region_table(country)
    g = fine[["id", "name", "geometry"]].copy()
    g["geometry"] = g.geometry.simplify_coverage(TOLERANCE).set_precision(PRECISION)
    return g[~g.geometry.is_empty].reset_index(drop=True)


def main() -> None:
    for c in ("GR", "AR"):
        g = mcp_polygons(c)
        path = OUT / c.lower() / "regions_mcp.geojson"
        path.write_text(g.to_json(drop_id=True))
        print(f"{c}: {len(g)} regions, {path.stat().st_size / 1e6:.2f} MB -> {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
