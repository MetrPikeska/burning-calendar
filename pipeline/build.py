"""Build the static JSON for one country.

Usage: uv run python pipeline/build.py --country GR [--refresh]
Run with --refresh after download_firms_api.py so the detection cache picks up the 2026 files.
Writes web/public/data/v1/{country}/: index.json, regions/{id}.json, regions.geojson, validation.json.
Regions: the whole country (id = country code, level `country`) plus the fitting level
(NUTS2 for Greece), each fitted with the national factor as the last fallback.
"""

import argparse
from datetime import datetime, timezone
import json

import pandas as pd

from calendar_metrics import anomalies, outage_days, season_metrics
from export import ROOT, export_country, write_json
from filters import drop_static
from harmonize import CLIM_END, END, START, detection_days, fit, monthly_counts, series
from load import COUNTRIES, load
from regions import assign, region_areas, region_table
from validate import raw_start_month, validate

OUTAGE_MIN_DAYS = 3
LEVEL = {"GR": "nuts2", "AR": "province"}


def build_region(rid: str, name: str, level: str, parent: str | None, m: pd.DataFrame,
                 national: pd.DataFrame | None, outages: pd.DataFrame, area_km2: float,
                 days: pd.DataFrame, provisional_from: str | None = None) -> dict:
    start = raw_start_month(m)
    val, band = validate(m, national, start)
    mode = val["mode"]
    F, G = fit(m, national)
    rec = series(m, F, G, band, mode)
    metric = rec["harm"] if mode == "harmonized" else rec["modis"].astype(float)
    summary, years = season_metrics(metric, start_month=start, clim_end=CLIM_END)
    an = anomalies(metric)
    is_viirs = outages["satellite"] == "S-NPP"
    od = outage_days(rec.index, outages[~is_viirs])
    od_v = outage_days(rec.index, outages[is_viirs])
    rec["anom_pct"] = an["anom_pct"]
    rec["anom"] = an["anom"]
    for k in ("baseline_median", "baseline_p90", "baseline_years"):
        rec[k] = an[k]
    rec["days_modis"] = days["days_modis"]
    rec["days_viirs"] = days["days_viirs"]
    rec["outage_days"] = od.astype(int)
    rec["outage"] = od >= OUTAGE_MIN_DAYS
    rec["outage_days_viirs"] = od_v.astype(int)
    rec["outage_viirs"] = od_v >= OUTAGE_MIN_DAYS
    rec["provisional"] = (rec.index >= provisional_from) if provisional_from else False
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


BOUNDARY_SOURCE = {
    "GR": {"name": "GISCO NUTS 2024 (Eurostat), level 2; 1:1M for assignment, 1:20M for the map",
           "url": "https://gisco-services.ec.europa.eu/distribution/v2/nuts/",
           "terms_url": "https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units"},
    "AR": {"name": "IGN Argentina, layer ign:provincia (WFS), clipped at 56 S",
           "url": "https://wms.ign.gob.ar/geoserver/ign/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=ign%3Aprovincia",
           "terms_url": "https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG"},
}


def api_meta(country: str) -> dict | None:
    """data/raw/firms/api/{Country}_2026_meta.json written by download_firms_api.py, or None."""
    p = ROOT / "data" / "raw" / "firms" / "api" / f"{COUNTRIES[country]}_2026_meta.json"
    return json.loads(p.read_text()) if p.exists() else None


def provisional_from(meta: dict | None) -> str | None:
    """First month that holds NRT data, YYYY-MM."""
    if not meta:
        return None
    starts = [f["range"][0][:7] for f in meta["files"].values() if f["kind"] == "nrt"]
    return min(starts) if starts else None


def api_block(meta: dict) -> dict:
    return {
        "product": "NASA FIRMS area API, standard processing (SP) up to the last SP date, near real-time (NRT) after it",
        "url_pattern": "https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/{MODIS|VIIRS_SNPP}_{SP|NRT}/"
                       + meta["bbox"] + "/5/{date}",
        "bbox": meta["bbox"],
        "files": {name: {k: f[k] for k in ("source", "range", "downloaded")} for name, f in meta["files"].items()},
        "clip": "detections inside a region polygon or within 5 km of one (same rule as region assignment)",
        "nrt_type": "NRT has no type column: type 2 when the 0.01 deg cell (VIIRS) or its 3x3 block (MODIS) "
                    "had a non-zero type in SP 2023-2026, else 0",
    }


def source_block(country: str, det: pd.DataFrame) -> dict:
    """Machine-readable provenance for index.json: FIRMS files, versions, download dates, filters, boundaries."""
    files = sorted((ROOT / "data" / "raw" / "firms").glob(f"*_{COUNTRIES[country]}.csv"))
    meta = api_meta(country)
    dates = sorted({datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).strftime("%Y-%m-%d") for f in files})
    versions = {s: sorted(det.loc[det["sensor"] == s, "version"].astype(str).unique().tolist()) for s in ("modis", "viirs")}
    return {
        "firms": {
            "product": "NASA FIRMS country yearly archive, standard processing (SP)",
            "url_pattern": "https://firms.modaps.eosdis.nasa.gov/data/country/{modis|viirs-snpp}/{year}/{sensor}_{year}_"
                           + COUNTRIES[country] + ".csv",
            "modis": {"instrument": "MODIS Collection 6.1, Terra and Aqua, 1 km",
                      "years": "2000-2026" if meta else "2000-2025", "versions": versions["modis"]},
            "viirs": {"instrument": "VIIRS S-NPP 375 m", "years": "2012-2026" if meta else "2012-2025",
                      "versions": versions["viirs"]},
            "files": len(files),
            "downloaded": dates,
            "api_2026": api_block(meta) if meta else None,
            "terms_url": "https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance",
        },
        "filters": {
            "type": "type == 0 (presumed vegetation fire) only",
            "static_sources": "0.01 deg cells with detections on 16 or more distinct days in a year removed, per sensor and year",
        },
        "boundaries": BOUNDARY_SOURCE[country],
        "area_crs": "EPSG:6933",
    }


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
    prov = provisional_from(api_meta(c))
    print("provisional from:", prov)

    national = monthly_counts(kept)
    out = [build_region(c, COUNTRIES[c], "country", None, national, None, outages,
                        round(sum(areas.values()), 1), detection_days(kept), prov)]
    for _, p in polys.sort_values("id").iterrows():
        sub = kept[kept["region"] == p["id"]]
        out.append(build_region(p["id"], p["name"], LEVEL[c], c, monthly_counts(sub), national, outages,
                                areas[p["id"]], detection_days(sub), prov))

    for r in out:
        e = r["entry"]
        print(f"{e['id']:5} {e['mode']:10} mdape={e['loyo_mdape_pct']} peak_hit={e['peak_hit_rate']} "
              f"raw={e['peak_hit_rate_raw']} gap={r['detail']['validation']['fit_window_gap_pct']} "
              f"reasons={r['detail']['validation']['mode_reasons']}")

    meta = {"period": {"start": START, "end": END, "provisional_from": prov}, "fixture": False, "method_version": "v1-region-month-dn-loyo", "source": source_block(c, kept),
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
