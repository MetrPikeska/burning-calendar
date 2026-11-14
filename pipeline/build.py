"""Build the static JSON for one country.

Usage: uv run python pipeline/build.py --country GR [--refresh]
Step 1 (vertical slice): the whole country is one region with id = country code.
"""

import argparse

import pandas as pd

from calendar_metrics import anomalies, outage_days, season_metrics
from export import ROOT, export_country
from filters import drop_static
from harmonize import fit, monthly_counts, series
from load import COUNTRIES, load

OUTAGE_MIN_DAYS = 3


def build_region(rid: str, name: str, level: str, det: pd.DataFrame, outages: pd.DataFrame) -> dict:
    m = monthly_counts(det)
    F, G = fit(m)
    rec = series(m, F, G).set_index("ym")
    mode = "harmonized"
    metric_series = rec["harm"] if mode == "harmonized" else rec["modis"].astype(float)
    summary, years = season_metrics(metric_series)
    an = anomalies(metric_series)
    od = outage_days(rec.index, outages)
    rec["anom_pct"] = an["anom_pct"]
    rec["anom"] = an["anom"]
    rec["outage_days"] = od.astype(int)
    rec["outage"] = od >= OUTAGE_MIN_DAYS
    months = rec.reset_index().to_dict("records")
    full_years = [y for y in years]
    entry = {"id": rid, "name": name, "level": level, "parent": None, "mode": mode, **summary,
             "harm_annual_mean": round(sum(y["total"] for y in full_years) / max(len(full_years), 1), 1)}
    factors = F.assign(kind="viirs_over_modis", window="2012-2019")
    chain = G.assign(kind="modis_over_terra", window="2003-2011")
    detail = {"id": rid, "name": name, "level": level, "mode": mode, "summary": summary,
              "months": months, "years": years,
              "factors": pd.concat([factors, chain]).round(4).to_dict("records")}
    return {"entry": entry, "detail": detail, "F": F, "G": G}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", default="GR", choices=list(COUNTRIES))
    ap.add_argument("--refresh", action="store_true", help="re-read raw CSVs")
    a = ap.parse_args()

    det = load(a.country, refresh=a.refresh)
    kept, flagged = drop_static(det)
    print(f"static filter: {len(det)} -> {len(kept)} rows, {len(flagged)} sensor-year-cells dropped")
    outages = pd.read_csv(ROOT / "data" / "outages.csv")

    r = build_region(a.country, COUNTRIES[a.country], "country", kept, outages)
    print(r["F"].to_string(index=False))
    print(r["G"].to_string(index=False))
    print(r["entry"])
    meta = {"fixture": False, "method_version": "v0-national-month-dn",
            "notes": "v0: one national region; harm_lo/harm_hi from 10th/90th percentile of yearly ratios, not LOYO yet"}
    out = export_country(a.country, COUNTRIES[a.country], [r], meta)
    print("wrote", out)


if __name__ == "__main__":
    main()
