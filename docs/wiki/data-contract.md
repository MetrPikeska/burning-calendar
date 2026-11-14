---
title: Data contract (pipeline to web)
updated: 2026-11-13
verified_by: n/a, design decided 13 Nov 2026; check against pipeline output once it exists
sources: [decisions.md, harmonization.md, calendar-and-anomalies.md]
---

The Python pipeline writes static files and the web app only reads them. No backend.

## Files

| Path | Content |
|---|---|
| `index.json` | One per country. `schema_version`, `generated_at`, list of regions with summary metrics and `mode`. Enough to draw the map. |
| `regions/{id}.json` | Monthly series and per-year metrics for one region, loaded on click. |
| `{country}.topojson` | Region geometry. Object `id` equals the region key in `index.json`: NUTS code for Greece, IGN `in1` for Argentina. |

`{id}` is the NUTS code or IGN id. Lower-level units (NUTS3, departments) have their own file and carry the factor of their parent unit.

## `index.json`, one region entry

- `id`, `name`, `level` (`nuts2`, `nuts3`, `province`, `department`), `parent`
- `mode`: `harmonized` or `relative` (criterion in [decisions.md](decisions.md))
- climatology over the full period: `peak_month`, `onset`, `end`, `season_length`, `season_start_month` (climatological minimum), `bimodal`

## `regions/{id}.json`

Monthly record:

```json
{"ym":"2007-08","modis":41,"viirs":null,"harm":143.5,"harm_lo":118,"harm_hi":171,
 "src":"backcast","fit_level":"region_month_dn","outage":false,"outage_days":0}
```

- `src`: `observed` (VIIRS, 2012 on), `backcast` (MODIS Terra+Aqua times factor), `backcast_terra` (Nov 2000 to Jun 2002, chained factor).
- For `observed`, `harm` equals `viirs` and `harm_lo` / `harm_hi` are null.
- `harm_lo` / `harm_hi` come from the LOYO residuals of the stratum.
- `fit_level`: the fallback level the factor was fitted at.
- Day and night are fitted separately; only their sum is stored.
- In `relative` mode, `harm`, `harm_lo` and `harm_hi` are null.
- `outage`: true when a sensor outage from `data/outages.csv` covers at least 3 days of the month.
- No FRP fields yet. They come as optional fields with the FRP layer.

Per-year metrics: `onset`, `end`, `season_length`, `peak_month`, computed on the region's season year.

Anomalies for the default view are precomputed (percentile rank vs the preceding 10 years). The web recomputes them in JS only for a range the user picks. CSV export is generated in JS from the monthly records.

Series: Nov 2000 to Dec 2025.
