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
    assert pd.isna(d.loc["2005-07", "days_viirs"])  # no VIIRS before Feb 2012
    assert d.loc["2016-01", "days_viirs"] == 0
    assert len(d) == 312  # 2000-11 .. 2026-10


def test_partial_january_2012_stays_out_of_the_fit_and_is_back_cast():
    """FIRMS S-NPP starts 20 Jan 2012: Jan 2012 VIIRS covers 12 days and must not enter the ratio."""
    from harmonize import series

    rows = []
    for y in range(2012, 2020):
        viirs_jan = 5 if y == 2012 else 30  # 2012: partial month, far below the true ratio
        rows += [("modis", "Aqua", f"{y}-01", "D", 10), ("viirs", "N", f"{y}-01", "D", viirs_jan)]
    m = monthly_counts(detections(rows))
    F = fit_ratio(m, "viirs", "modis", range(2012, 2020))
    jan = F[(F.month == 1) & (F.dn == "D")].iloc[0]
    assert jan["f"] == 3.0
    assert jan["den_total"] == 70  # 2013-2019 only
    G = F.assign(f=1.0)
    rec = series(m, F, G)
    assert rec.loc["2012-01", "src"] == "backcast"
    assert rec.loc["2012-01", "harm"] == 30.0
    assert rec.loc["2012-01", "viirs"] == 5  # raw partial count stays visible
    assert rec.loc["2012-02", "src"] == "observed"


def test_relative_mode_marks_every_month_observed():
    """Audit BC-003: a relative region has no back-cast, so raw MODIS before 2012 is not 'backcast'."""
    from harmonize import series

    rows = []
    for y in range(2005, 2020):
        rows += [("modis", "Aqua", f"{y}-07", "D", 10)]
        if y >= 2012:
            rows += [("viirs", "N", f"{y}-07", "D", 30)]
    m = monthly_counts(detections(rows))
    F = fit_ratio(m, "viirs", "modis", range(2012, 2020))
    rec = series(m, F, F.assign(f=1.0), None, "relative")
    assert (rec["src"] == "observed").all()
    assert rec["fit_level"].isna().all()
    assert rec["harm"].isna().all()
    assert rec.loc["2007-07", "modis"] == 10


def test_loyo_compares_2012_from_february():
    from validate import loyo

    rows = []
    for y in range(2012, 2020):
        for mo in (1, 2):
            rows += [("modis", "Aqua", f"{y}-{mo:02d}", "D", 10), ("viirs", "N", f"{y}-{mo:02d}", "D", 30)]
    lo = loyo(monthly_counts(detections(rows)), None)
    assert not ((lo["year"] == 2012) & (lo["month"] == 1)).any()
    assert ((lo["year"] == 2012) & (lo["month"] == 2)).any()
