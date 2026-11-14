import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import download_firms_api as api  # noqa: E402
from load import cell_key, fill_nrt_type  # noqa: E402


@pytest.mark.parametrize("text,key", [
    ("FIRMS_MAP_KEY=abc123\n", "abc123"),
    ("export FIRMS_MAP_KEY=\"abc123\"\n", "abc123"),
    ("OTHER=1\nFIRMS_MAP_KEY = 'abc123'  \n", "abc123"),
    ("FIRMS_MAP_KEY=\nabc123\n", None),  # the key alone on a line does not count
    ("# FIRMS_MAP_KEY=abc123\n", None),
])
def test_parse_env(text, key):
    assert api.parse_env(text) == key


def test_map_key_from_file_and_missing(tmp_path, monkeypatch):
    monkeypatch.delenv(api.KEY_VAR, raising=False)
    f = tmp_path / ".env"
    f.write_text("FIRMS_MAP_KEY=k1\n")
    assert api.map_key([tmp_path / "missing", f]) == "k1"
    f.write_text("k1\n")
    with pytest.raises(SystemExit, match="FIRMS_MAP_KEY"):
        api.map_key([f])


def test_map_key_env_wins(tmp_path, monkeypatch):
    monkeypatch.setenv(api.KEY_VAR, "from-env")
    (tmp_path / ".env").write_text("FIRMS_MAP_KEY=from-file\n")
    assert api.map_key([tmp_path / ".env"]) == "from-env"


def test_windows_cover_range_without_overlap():
    w = api.windows(date(2026, 1, 1), date(2026, 10, 31))
    days = [pd.Timestamp(d) + pd.Timedelta(days=i) for d, n in w for i in range(n)]
    assert days == list(pd.date_range("2026-01-01", "2026-10-31"))
    assert all(1 <= n <= api.DAY_RANGE for _, n in w)


def test_plan_seam_has_no_shared_date():
    p = api.plan(date(2026, 7, 31))
    assert p == [("sp", date(2026, 1, 1), date(2026, 7, 31)), ("nrt", date(2026, 8, 1), date(2026, 10, 31))]
    assert api.plan(date(2026, 12, 31)) == [("sp", date(2026, 1, 1), date(2026, 10, 31))]
    assert api.plan(None) == [("nrt", date(2026, 1, 1), date(2026, 10, 31))]


def test_mask_hides_key():
    assert api.mask("HTTP 500 for https://x/api/area/csv/SECRET/MODIS_NRT/w", "SECRET") == \
        "HTTP 500 for https://x/api/area/csv/***/MODIS_NRT/w"


def test_fill_nrt_type_uses_sp_static_cells():
    rows = [  # sensor, provisional, lat, lon, type, date
        ("viirs", False, 38.505, 22.505, 2, "2025-03-01"),   # static cell in SP
        ("viirs", True, 38.507, 22.508, np.nan, "2026-09-01"),  # same 0.01 cell -> 2
        ("viirs", True, 38.515, 22.505, np.nan, "2026-09-01"),  # neighbour cell, VIIRS no dilation -> 0
        ("modis", False, 40.005, 23.005, 2, "2024-06-01"),
        ("modis", True, 40.015, 23.015, np.nan, "2026-09-01"),  # 3x3 block for MODIS -> 2
        ("modis", True, 40.035, 23.005, np.nan, "2026-09-01"),  # two cells away -> 0
        ("viirs", False, 37.0, 21.0, 2, "2019-01-01"),        # before the mask years: ignored
        ("viirs", True, 37.0, 21.0, np.nan, "2026-09-01"),
    ]
    df = pd.DataFrame(rows, columns=["sensor", "provisional", "latitude", "longitude", "type", "acq_date"])
    out = fill_nrt_type(df)
    assert out["type"].tolist() == [2, 2, 0, 2, 2, 0, 2, 0]
    assert cell_key(df["latitude"][:1], df["longitude"][:1]).iloc[0] == 3850 * 100_000 + 2250
