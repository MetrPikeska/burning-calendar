import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
from harmonize import fit_ratio, model, monthly_counts  # noqa: E402


def detections(rows):
    """rows: (sensor, satellite, ym, daynight, n)."""
    out = []
    for sensor, sat, ym, dn, n in rows:
        out += [{"sensor": sensor, "satellite": sat, "ym": ym, "daynight": dn}] * n
    return pd.DataFrame(out)


def test_month_stratum_used_when_thick_enough():
    rows = []
    for y in range(2012, 2020):
        rows += [("modis", "Aqua", f"{y}-08", "D", 10), ("viirs", "N", f"{y}-08", "D", 30)]
    m = monthly_counts(detections(rows))
    F = fit_ratio(m, "viirs", "modis", range(2012, 2020))
    aug = F[(F.month == 8) & (F.dn == "D")].iloc[0]
    assert aug["level"] == "region_month_dn"
    assert aug["f"] == 3.0


def test_thin_region_falls_back_to_national():
    region = monthly_counts(detections([("modis", "Aqua", "2015-08", "N", 2), ("viirs", "N", "2015-08", "N", 9)]))
    rows = []
    for y in range(2012, 2020):
        rows += [("modis", "Aqua", f"{y}-07", "N", 10), ("viirs", "N", f"{y}-07", "N", 50)]
    national = monthly_counts(detections(rows))
    F = fit_ratio(region, "viirs", "modis", range(2012, 2020), national)
    aug = F[(F.month == 8) & (F.dn == "N")].iloc[0]
    assert aug["level"] == "national_dn"
    assert aug["f"] == 5.0


def test_terra_only_months_use_chained_factor():
    m = monthly_counts(detections([("modis", "Terra", "2001-08", "D", 10)]))
    F = pd.DataFrame([{"month": mo, "dn": dn, "f": 3.0, "level": "region_month_dn"} for mo in range(1, 13) for dn in "DN"])
    G = F.assign(f=2.0)
    assert model(m, F, G).loc["2001-08", "model"] == 60.0


def test_detection_days_counts_distinct_dates_per_sensor():
    from harmonize import detection_days

    df = pd.DataFrame({
        "sensor": ["viirs", "viirs", "viirs", "modis", "modis"],
        "acq_date": pd.to_datetime(["2015-08-01", "2015-08-01", "2015-08-03", "2015-08-01", "2005-07-09"]),
        "ym": ["2015-08", "2015-08", "2015-08", "2015-08", "2005-07"],
    })
    d = detection_days(df)
    assert d.loc["2015-08", "days_viirs"] == 2
    assert d.loc["2015-08", "days_modis"] == 1
    assert d.loc["2005-07", "days_modis"] == 1
    assert pd.isna(d.loc["2005-07", "days_viirs"])  # no VIIRS before 2012
    assert d.loc["2016-01", "days_viirs"] == 0
    assert len(d) == 302
