---
title: Data contract (pipeline to web)
updated: 2026-11-14
verified_by: uv run python pipeline/build.py --country GR, then read web/public/data/v1/gr/; uv run pytest tests/test_export.py
sources: [decisions.md, harmonization.md, calendar-and-anomalies.md, ../../pipeline/build.py, ../../pipeline/export.py]
---

The Python pipeline writes static files under `web/public/data/v1/{gr,ar}/` and the web app only reads them. No backend. The generated JSON is committed, so Vercel needs no Python and the demo works offline.

## Files

| Path | Content |
|---|---|
| `index.json` | One per country. Header plus a list of regions with summary metrics and `mode`. Enough to draw the map. |
| `regions/{id}.json` | Monthly series, per-season-year metrics and fitted factors for one region, loaded on click. |
| `regions.geojson` | Region geometry for the map, GeoJSON FeatureCollection (EPSG:4326, coordinates rounded to 0.001°), properties `id` and `name`. `id` equals the region key in `index.json`: NUTS code for Greece, IGN `in1` for Argentina. Greece: GISCO NUTS 2024 1:20M, 15 kB. |
| `regions_mcp.geojson` | Polygons for the MCP tool `find_region_at` only, written by `uv run python pipeline/mcp_geometry.py`: the assignment polygons of `regions.region_table` (Greece NUTS 2024 1:1M, Argentina IGN simplified to 0.001°), coverage-simplified to 0.001° with shared borders kept, coordinates rounded to 0.0001°. Same properties as `regions.geojson`. Greece 0.27 MB, Argentina 1.2 MB. Not rebuilt by `build.py`; rerun the script when boundaries change. |
| `regions/{id}.csv` | The `months` records of `regions/{id}.json` as CSV with leading `region_id` and `mode` columns; empty cell = null, booleans `true`/`false`. |
| `detections/{id}.csv` | Greece only. Individual FIRMS detections behind the counts, written by `uv run python pipeline/hotspots.py --country GR` (same type and static filters and region assignment as `build.py`). Columns `region_id`, `sensor` (`modis`, `viirs`), `satellite` (`Terra`, `Aqua`, `N`), `acq_date`, `acq_time` (UTC `HHMM`), `daynight`, `latitude`, `longitude`, `frp` (MW), `confidence` (MODIS 0-100, VIIRS `l`/`n`/`h`), `version`, `provisional` (`true` for NRT rows). Rows per month and sensor equal `modis` and `viirs` of `regions/{id}.json` (tested). `GR.csv` also holds the 240 detections outside every NUTS2 polygon, as the national counts do. 124,694 rows (to Oct 2026), 16.1 MB for all 14 files. Argentina (4.48 M rows, ~270 MB) is not hosted. |
| `validation.json` | Per-country validation: static filter and assignment counts, and per region the LOYO, time split, fit window gap, ratio trend, mode and mode reasons. |

Shared files: `data/v1/schema/index.schema.json` and `data/v1/schema/region.schema.json` (JSON Schema 2020-12, checked against every file by `tests/test_export.py`), `/llms.txt` at the site root.

`{id}` is the NUTS code or IGN id. Lower-level units (NUTS3, departments) have their own file and carry the factor of their parent unit. The country itself is also a region: `id` = country code (`GR`), `level` = `country`, `parent` = null, fitted on national counts. Fitting-level regions (NUTS2) have `parent` = country code.

## `index.json`

Header: `schema_version` (`"1"`), `generated_at` (UTC ISO), `country`, `country_name`, `period` (`{"start":"2000-11","end":"2026-10","provisional_from":"2026-08"}`; `provisional_from` is the first month built partly from FIRMS NRT data, null when none), `units`, `fixture` (bool), `method_version` (e.g. `v1-region-month-dn-loyo`), `source`, `notes`, `regions`.

`source` (provenance): `firms` (product, URL pattern, MODIS and VIIRS instrument, years and `version` values found in the files, number of files, download dates from the file times, `api_2026` with the area API files, date ranges, bounding box, clip rule and NRT type rule, terms URL), `filters` (type 0, static-source rule), `boundaries` (name, URL, terms URL), `area_crs`. Licence texts are linked, not yet verified.

One region entry:

- `id`, `name`, `level` (`country`, `nuts2`, `nuts3`, `province`, `department`), `parent`
- `mode`: `harmonized` or `relative` (criterion in [decisions.md](decisions.md))
- climatology over the full period, months 1-12: `peak_month`, `onset`, `end`, `season_length` (months, inclusive), `season_start_month` (climatological minimum), `bimodal`
- `annual_mean`: mean season-year total, for map colouring; `annual_mean_of`: `harm` or `modis` (in `relative` mode the mean is of MODIS counts, so do not colour both modes on one scale)
- `area_km2`: area of the assignment polygons in EPSG:6933 (equal-area); the country entry is the sum of its regions. Argentina 94 includes the Malvinas. `density_per_1000km2`: `annual_mean` per 1000 km2 per year, on the same series as `annual_mean_of`
- `loyo_mdape_pct`, `peak_hit_rate`, `peak_hit_rate_raw`: validation summary (LOYO annual median absolute error; peak-month hit rate of the harmonized and of raw MODIS against VIIRS)
- `season_start_month` is the climatological minimum of the region's MODIS series (scale-free, the same in both modes)

## `regions/{id}.json`

Header: `schema_version`, `generated_at`, `units` ("VIIRS-equivalent ..." in harmonized mode, "raw MODIS Collection 6.1 ...; not VIIRS-equivalent" in relative mode, since 15 Nov), `id`, `name`, `level`, `parent`, `mode`, `area_km2`, `summary` (same climatology fields as the index entry), `months`, `years`, `factors`, `band`, `validation` (same object as in `validation.json`).

Monthly record (`months`, 312 entries, Nov 2000 to Oct 2026):

```json
{"ym":"2007-08","modis":41,"viirs":null,"harm":143.5,"harm_lo":118.0,"harm_hi":171.0,
 "src":"backcast","fit_level":"region_month_dn","anom_pct":90.0,"anom":false,
 "outage_days":0,"outage":false,"baseline_median":98.2,"baseline_p90":160.4,
 "baseline_years":"2002-2011 without 2007"}
```

- `modis`: Terra + Aqua count after filters. `viirs`: S-NPP count, null before 2012; Jan 2012 holds the raw partial count (record starts 20 Jan 2012, `outage_viirs` true).
- `src`: `observed` (VIIRS, Feb 2012 on), `backcast` (Jan 2012 included) (MODIS Terra+Aqua times factor), `backcast_terra` (Nov 2000 to Jun 2002, chained factor).
- For `observed`, `harm` equals `viirs` and `harm_lo` / `harm_hi` are null.
- `harm_lo` / `harm_hi`: modelled value times the 10th / 90th percentile of LOYO obs/pred ratios of the region, pooled by meteorological season (`band`: `month`, `q_lo`, `q_hi`).
- `fit_level`: the coarsest fallback level among the day and night strata of that month: `region_month_dn`, `region_season_dn`, `region_dn` (later `national_dn`). Null for `observed`.
- Day and night are fitted separately; only their sum is stored.
- `anom_pct`: percentile rank (0-100) of the month among the same month of the preceding 10 years; years before 2012 use 2002-2011 minus the target year. `anom`: above the baseline 90th percentile. Computed on `harm` in `harmonized` mode, on `modis` in `relative` mode.
- `baseline_median`, `baseline_p90`: median and 90th percentile of the same calendar month over the baseline years, on the same series as `anom_pct`. `baseline_years`: the window as text, `YYYY-YYYY` or `2002-2011 without YYYY`. All three null when fewer than 5 baseline values exist. The web's month-vs-median panel and the MCP `get_anomalies` tool read these instead of recomputing.
- `days_modis`, `days_viirs`: days of the month with at least one detection after filters (distinct `acq_date`, UTC), per sensor; `days_viirs` null before 2012. A count that one large fire cannot inflate the way it inflates detections.
- `outage_days`: days of the month covered by MODIS (Terra, Aqua) gaps in `data/outages.csv`. `outage`: `outage_days >= 3`.
- `outage_days_viirs`, `outage_viirs`: the same for VIIRS S-NPP gaps (14 days in Mar-Jul 2026). Observed months depend on VIIRS, back-cast and `relative`-mode values on MODIS; web and MCP show the gap of the satellite behind the value.
- `provisional`: true from `period.provisional_from` (Aug 2026) on. The month uses FIRMS NRT data (VIIRS from Aug, MODIS from Sep 2026) and may change when SP replaces it.
- Jan-Oct 2026 come from the area API, clipped to the country ([data-firms.md](data-firms.md)). Climatology fields (`summary`, `season_start_month`) use complete calendar years to 2025 only; season years and anomalies include 2026.
- In `relative` mode, `harm`, `harm_lo` and `harm_hi` are null; season metrics, `years.total`, anomalies and baseline fields are computed on `modis`.
- No FRP fields yet. They come as optional fields with the FRP layer.

Per-season-year record (`years`): `season_year` (the calendar year holding most of the season's months: the start year when `season_start_month` is 1-7, the next year when it is 8-12; Entre Ríos Dec 2019 to Nov 2020 is `2020`), `onset`, `end`, `season_length`, `peak_month`, `total`. Only complete season years are listed.

`factors`: one row per calendar month × day/night × kind: `month`, `dn`, `f`, `level`, `den_total` (denominator count in the fit window), `kind` (`viirs_over_modis` on 2012-2019, `modis_over_terra` on 2003-2011), `window`.

The web recomputes anomalies in JS only for a range the user picks. CSV export of a user-picked range is generated in JS from the monthly records; the full series is precomputed as `regions/{id}.csv`.
