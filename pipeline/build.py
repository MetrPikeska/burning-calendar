"""Build the static JSON for one country.

Usage: uv run python pipeline/build.py --country GR [--refresh]
Writes web/public/data/v1/{country}/: index.json, regions/{id}.json, regions.geojson, validation.json.
Regions: the whole country (id = country code, level `country`) plus the fitting level
(NUTS2 for Greece), each fitted with the national factor as the last fallback.
"""

import argparse
import json

import pandas as pd

from calendar_metrics import anomalies, outage_days, season_metrics
from export import ROOT, export_country, write_json
from filters import drop_static
from harmonize import fit, monthly_counts, series
from load import COUNTRIES, load
from regions import assign, region_areas, region_table
from validate import raw_start_month, validate

OUTAGE_MIN_DAYS = 3
LEVEL = {"GR": "nuts2", "AR": "province"}


def build_region(rid: str, name: str, level: str, parent: str | None, m: pd.DataFrame,
                 national: pd.DataFrame | None, outages: pd.DataFrame, area_km2: float) -> dict:
    start = raw_start_month(m)
    val, band = validate(m, national, start)
    mode = val["mode"]
    F, G = fit(m, national)
    rec = series(m, F, G, band, mode)
    metric = rec["harm"] if mode == "harmonized" else rec["modis"].astype(float)
    summary, years = season_metrics(metric, start_month=start)
    an = anomalies(metric)
    od = outage_days(rec.index, outages)
    rec["anom_pct"] = an["anom_pct"]
    rec["anom"] = an["anom"]
    for k in ("baseline_median", "baseline_p90", "baseline_years"):
        rec[k] = an[k]
    rec["outage_days"] = od.astype(int)
    rec["outage"] = od >= OUTAGE_MIN_DAYS
    months = [{k: (None if pd.isna(v) else v) for k, v in r.items()}
              for r in rec.reset_index().to_dict("records")]
    annual_mean = round(sum(y["total"] for y in years) / max(len(years), 1), 1)
    density = round(1000 * annual_mean / area_km2, 2) if area_km2 > 0 else None
    entry = {"id": rid, "name": name, "level": level, "parent": parent, "mode": mode, **summary,
             "annual_mean": annual_mean,
             "annual_mean_of": "harm" if mode == "harmonized" else "modis",
             "area_km2": area_km2,
             "density_per_1000km2": density,
             "loyo_mdape_pct": val["loyo"]["annual_mdape_pct"],
             "peak_hit_rate": val["loyo"]["season"]["harm"]["peak_hit_rate"],
             "peak_hit_rate_raw": val["loyo"]["season"]["modis_raw"]["peak_hit_rate"]}
    factors = pd.concat([F.assign(kind="viirs_over_modis", window="2012-2019"),
                         G.assign(kind="modis_over_terra", window="2003-2011")])
    detail = {"id": rid, "name": name, "level": level, "parent": parent, "mode": mode, "area_km2": area_km2,
              "summary": summary, "months": months, "years": years,
              "factors": factors.round(4).to_dict("records"), "band": band.to_dict("records"),
              "validation": val}
    return {"entry": entry, "detail": detail}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", default="GR", choices=list(COUNTRIES))
    ap.add_argument("--refresh", action="store_true", help="re-read raw CSVs")
    a = ap.parse_args()
    c = a.country

    det = load(c, refresh=a.refresh)
    kept, flagged = drop_static(det)
    print(f"static filter: {len(det)} -> {len(kept)} rows, {len(flagged)} sensor-year-cells dropped")
    polys, web_polys = region_table(c)
    kept["region"], assign_stats = assign(kept, polys)
    print("assignment:", assign_stats)
    outages = pd.read_csv(ROOT / "data" / "outages.csv")
    areas = region_areas(polys)

    national = monthly_counts(kept)
    out = [build_region(c, COUNTRIES[c], "country", None, national, None, outages,
                        round(sum(areas.values()), 1))]
    for _, p in polys.sort_values("id").iterrows():
        m = monthly_counts(kept[kept["region"] == p["id"]])
        out.append(build_region(p["id"], p["name"], LEVEL[c], c, m, national, outages, areas[p["id"]]))

    for r in out:
        e = r["entry"]
        print(f"{e['id']:5} {e['mode']:10} mdape={e['loyo_mdape_pct']} peak_hit={e['peak_hit_rate']} "
              f"raw={e['peak_hit_rate_raw']} gap={r['detail']['validation']['fit_window_gap_pct']} "
              f"reasons={r['detail']['validation']['mode_reasons']}")

    meta = {"fixture": False, "method_version": "v1-region-month-dn-loyo",
            "notes": "Factors per region x month x day/night on 2012-2019 with fallback to season, "
                     "region and national; harm_lo/harm_hi from LOYO obs/pred 10th-90th percentile by season."}
    dest = export_country(c, COUNTRIES[c], out, meta)
    gj = web_polys[["id", "name", "geometry"]].copy()
    gj["geometry"] = gj.geometry.set_precision(0.001)
    (dest / "regions.geojson").write_text(gj.to_json(drop_id=True))
    write_json(dest / "validation.json", {
        "country": c, "static_filter": {"rows_in": len(det), "rows_out": len(kept),
                                        "cells_dropped": len(flagged)},
        "assignment": assign_stats,
        "regions": {r["entry"]["id"]: r["detail"]["validation"] for r in out}})
    print("wrote", dest)


if __name__ == "__main__":
    main()
