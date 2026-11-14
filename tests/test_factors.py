import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pytest
import xarray as xr
from shapely.geometry import box

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import factors  # noqa: E402


def _polys():
    return gpd.GeoDataFrame({"id": ["A", "B", "C"], "name": ["a", "b", "c"]},
                            geometry=[box(0, 0, 1, 1), box(1, 0, 2, 1), box(5.1, 5.1, 5.2, 5.2)], crs="EPSG:4326")


def _grid():
    lons = np.array([0.25, 0.75, 1.25, 1.75, 5.0, 5.5])
    lats = np.array([0.25, 0.75, 5.0])
    times = pd.date_range("2020-01-01", "2020-02-29", freq="D")
    data = np.zeros((len(times), len(lats), len(lons)))
    data[:, :, :2] = 10.0   # region A cells
    data[:, :, 2:4] = 20.0  # region B cells
    return xr.DataArray(data, dims=("time", "latitude", "longitude"),
                        coords={"time": times, "latitude": lats, "longitude": lons})


def test_cell_index_inside_and_nearest_fallback():
    da = _grid()
    cells = factors.cell_index(da["longitude"].to_numpy(), da["latitude"].to_numpy(), _polys())
    assert len(cells["A"]) == 4 and len(cells["B"]) == 4
    # C has no cell centre inside: one nearest cell is used
    assert len(cells["C"]) == 1


def test_monthly_by_region_mean_and_max():
    da = _grid()
    cells = factors.cell_index(da["longitude"].to_numpy(), da["latitude"].to_numpy(), _polys())
    m = factors.monthly_by_region(da, cells)
    assert list(m.index) == ["2020-01", "2020-02"]
    assert m.loc["2020-01", "A"] == pytest.approx(10.0)
    assert m.loc["2020-02", "B"] == pytest.approx(20.0)
    assert factors.monthly_by_region(da, cells, "max").loc["2020-01", "B"] == pytest.approx(20.0)


def test_percentile_by_calendar_month_needs_enough_years():
    idx = [f"{y}-07" for y in range(2000, 2012)] + [f"{y}-08" for y in range(2000, 2005)]
    s = pd.Series(list(range(12)) + [1, 2, 3, 4, 5], index=idx, dtype=float)
    pct = factors.percentile_by_calendar_month(s)
    assert pct["2011-07"] == 100.0 and pct["2000-07"] == pytest.approx(100 / 12)
    assert pct["2003-08"] != pct["2003-08"]  # NaN: only 5 Augusts


@pytest.mark.parametrize("pct,level", [(None, None), (float("nan"), None), (10, "normal"), (75, "elevated"),
                                       (89.9, "elevated"), (90, "critical"), (100, "critical")])
def test_fwi_level(pct, level):
    assert factors.fwi_level(pct) == level


@pytest.mark.parametrize("v,level", [(None, None), (-1.0, "dry"), (-0.99, "normal"), (0.0, "normal"), (1.2, "wet")])
def test_spei_level(v, level):
    assert factors.spei_level(v) == level


def test_context_months_without_inputs_is_all_null():
    yms = pd.Index(["2000-11", "2000-12"])
    out = factors.context_months(yms, None, None, None)
    assert out.isna().all().all() or out.drop(columns=["fwi_level", "spei3_level", "spei6_level"]).isna().all().all()
    assert out["fwi_level"].isna().all() and out["spei3_level"].isna().all()


def test_landcover_shares_sum_and_groups():
    polys = gpd.GeoDataFrame({"id": ["A"]}, geometry=[box(0, 0, 1, 1)], crs="EPSG:4326")
    clc = gpd.GeoDataFrame({"Code_18": ["211", "311", "324", "112"]},
                           geometry=[box(0, 0, 0.5, 1), box(0.5, 0, 1, 0.5), box(0.5, 0.5, 0.75, 1),
                                     box(0.75, 0.5, 1, 1)], crs="EPSG:4326")
    r = factors.landcover_shares(clc, polys).loc["A"]
    assert r["cropland_pct"] == pytest.approx(50, abs=1)
    assert r["tree_pct"] == pytest.approx(25, abs=1)
    assert r["shrub_grass_pct"] == pytest.approx(12.5, abs=1)
    assert r["cropland_pct"] + r["tree_pct"] + r["shrub_grass_pct"] + r["other_pct"] == pytest.approx(100, abs=0.3)


def test_region_context_with_and_without_data():
    yms = pd.Index([f"{y}-07" for y in range(2000, 2013)])
    fwi = pd.DataFrame({"A": np.arange(len(yms), dtype=float)}, index=yms)
    lc = pd.DataFrame({"cropland_pct": [40.0], "tree_pct": [10.0], "shrub_grass_pct": [20.0], "other_pct": [30.0]},
                      index=pd.Index(["A"], name="region_id"))
    ctx = {"fwi": fwi, "spei3": None, "spei6": None, "landcover": lc, "sources": {"fwi": {"name": "x"}}}
    months, block = factors.region_context(ctx, "A", yms)
    assert months["fwi_level"].iloc[-1] == "critical" and months["spei3"].isna().all()
    assert block["available"] and block["landcover"]["cropland_pct"] == 40.0
    months_b, block_b = factors.region_context(ctx, "B", yms)  # region without data
    assert months_b["fwi"].isna().all() and block_b["landcover"] is None and not block_b["available"]
    _, empty = factors.region_context({}, "A", yms)
    assert empty == {"available": False, "landcover": None, "sources": {}}
