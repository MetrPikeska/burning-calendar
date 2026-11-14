import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
from calendar_metrics import anomalies, is_bimodal, onset_end, season_metrics  # noqa: E402
from filters import drop_static  # noqa: E402


def monthly(values: dict[str, float]) -> pd.Series:
    return pd.Series(values, dtype=float)


def test_onset_end_wraps_calendar_months():
    # season starts in May; mass in Jul..Sep
    v = np.zeros(12)
    v[2:5] = [5, 80, 15]  # Jul, Aug, Sep relative to May; cum 5%, 85%, 100%
    assert onset_end(v, 5) == (8, 9, 2)


def test_onset_end_empty_season():
    assert onset_end(np.zeros(12), 1) == (None, None, None)


def test_bimodal_two_separated_peaks():
    clim = np.array([10, 12, 10, 1, 1, 1, 1, 1, 1, 8, 9, 2], float)
    assert is_bimodal(clim)


def test_unimodal_summer_peak():
    clim = np.array([1, 1, 2, 3, 5, 8, 12, 15, 10, 5, 2, 1], float)
    assert not is_bimodal(clim)


def test_season_metrics_skips_incomplete_years():
    yms = pd.period_range("2001-01", "2003-06", freq="M").strftime("%Y-%m")
    s = pd.Series([100.0 if ym.endswith("-08") else 1.0 for ym in yms], index=yms)
    summary, years = season_metrics(s)
    assert summary["peak_month"] == 8
    assert [y["season_year"] for y in years] == [2001, 2002]


def test_anomaly_flags_month_above_baseline():
    yms = pd.period_range("2002-01", "2013-12", freq="M").strftime("%Y-%m")
    s = pd.Series(1.0, index=yms)
    s["2013-08"] = 50.0
    an = anomalies(s)
    assert an.loc["2013-08", "anom"]
    assert an.loc["2013-08", "anom_pct"] == 100.0
    assert not an.loc["2013-07", "anom"]


def test_static_filter_drops_cell_year_per_sensor():
    days = pd.date_range("2015-01-01", periods=20, freq="D")
    static = pd.DataFrame({"sensor": "viirs", "year": 2015, "cell": 1, "acq_date": days})
    other_sensor = static.assign(sensor="modis").iloc[:5]
    fire = pd.DataFrame({"sensor": "viirs", "year": 2015, "cell": 2, "acq_date": days[:3]})
    kept, flagged = drop_static(pd.concat([static, other_sensor, fire], ignore_index=True))
    assert len(flagged) == 1
    assert set(kept["cell"]) == {1, 2}
    assert (kept[kept.cell == 1]["sensor"] == "modis").all()


def test_season_year_label_follows_majority_of_months():
    yms = pd.period_range("2001-01", "2003-12", freq="M").strftime("%Y-%m")
    # minimum in December -> season Dec..Nov, labelled by the year of Jan..Nov
    s = pd.Series([0.0 if ym.endswith("-12") else 5.0 for ym in yms], index=yms)
    s["2002-08"] = 100.0
    summary, years = season_metrics(s)
    assert summary["season_start_month"] == 12
    labels = {y["season_year"]: y["total"] for y in years}
    assert 2002 in labels and labels[2002] > 100
