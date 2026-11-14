---
title: Data contract (pipeline to web)
updated: 2026-11-14
verified_by: uv run python pipeline/build.py --country GR, then read web/public/data/v1/gr/index.json and regions/GR.json
sources: [decisions.md, harmonization.md, calendar-and-anomalies.md, ../../pipeline/build.py, ../../pipeline/export.py]
---

The Python pipeline writes static files under `web/public/data/v1/{gr,ar}/` and the web app only reads them. No backend. The generated JSON is committed, so Vercel needs no Python and the demo works offline.

## Files

| Path | Content |
|---|---|
| `index.json` | One per country. Header plus a list of regions with summary metrics and `mode`. Enough to draw the map. |
| `regions/{id}.json` | Monthly series, per-season-year metrics and fitted factors for one region, loaded on click. |
| `{country}.topojson` | Region geometry (from step 2). Object `id` equals the region key in `index.json`: NUTS code for Greece, IGN `in1` for Argentina. |

`{id}` is the NUTS code or IGN id. Lower-level units (NUTS3, departments) have their own file and carry the factor of their parent unit. In the step 1 vertical slice (14 Nov 2026) the whole country is one region, `id` = `GR`, `level` = `country`.

## `index.json`

Header: `schema_version` (`"1"`), `generated_at` (UTC ISO), `country`, `country_name`, `period` (`{"start":"2000-11","end":"2025-12"}`), `units`, `fixture` (bool), `method_version` (e.g. `v0-national-month-dn`), `notes`, `regions`.

One region entry:

- `id`, `name`, `level` (`country`, `nuts2`, `nuts3`, `province`, `department`), `parent`
- `mode`: `harmonized` or `relative` (criterion in [decisions.md](decisions.md))
- climatology over the full period, months 1-12: `peak_month`, `onset`, `end`, `season_length` (months, inclusive), `season_start_month` (climatological minimum), `bimodal`
- `harm_annual_mean`: mean season-year total, for map colouring

## `regions/{id}.json`

Header: `schema_version`, `generated_at`, `units`, `id`, `name`, `level`, `mode`, `summary` (same climatology fields as the index entry), `months`, `years`, `factors`.

Monthly record (`months`, 302 entries, Nov 2000 to Dec 2025):

```json
{"ym":"2007-08","modis":41,"viirs":null,"harm":143.5,"harm_lo":118.0,"harm_hi":171.0,
 "src":"backcast","fit_level":"region_month_dn","anom_pct":90.0,"anom":false,
 "outage_days":0,"outage":false}
```

- `modis`: Terra + Aqua count after filters. `viirs`: S-NPP count, null before 2012.
- `src`: `observed` (VIIRS, 2012 on), `backcast` (MODIS Terra+Aqua times factor), `backcast_terra` (Nov 2000 to Jun 2002, chained factor).
- For `observed`, `harm` equals `viirs` and `harm_lo` / `harm_hi` are null.
- `harm_lo` / `harm_hi`: target is the LOYO residuals of the stratum (step 2). In `v0` they come from the 10th / 90th percentile of the yearly VIIRS/MODIS ratios of the stratum over 2012-2019.
- `fit_level`: the coarsest fallback level among the day and night strata of that month: `region_month_dn`, `region_season_dn`, `region_dn` (later `national_dn`). Null for `observed`.
- Day and night are fitted separately; only their sum is stored.
- `anom_pct`: percentile rank (0-100) of the month among the same month of the preceding 10 years; years before 2012 use 2002-2011 minus the target year. `anom`: above the baseline 90th percentile. Computed on `harm` in `harmonized` mode, on `modis` in `relative` mode.
- `outage_days`: days of the month covered by `data/outages.csv`. `outage`: `outage_days >= 3`.
- In `relative` mode, `harm`, `harm_lo` and `harm_hi` are null (not implemented yet, no region is `relative` in v0).
- No FRP fields yet. They come as optional fields with the FRP layer.

Per-season-year record (`years`): `season_year` (calendar year in which the season starts at `season_start_month`), `onset`, `end`, `season_length`, `peak_month`, `total`. Only complete season years are listed.

`factors`: one row per calendar month × day/night × kind: `month`, `dn`, `f`, `f_lo`, `f_hi`, `level`, `den_total` (denominator count in the fit window), `kind` (`viirs_over_modis` on 2012-2019, `modis_over_terra` on 2003-2011), `window`.

The web recomputes anomalies in JS only for a range the user picks. CSV export is generated in JS from the monthly records.
