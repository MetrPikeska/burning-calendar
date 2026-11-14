---
title: Findings, Argentina
updated: 2026-11-15
verified_by: uv run python pipeline/download_firms_api.py; uv run python pipeline/build.py --refresh --country AR; numbers from web/public/data/v1/ar/validation.json (method v1-region-month-dn-loyo)
sources: [../../pipeline/build.py, ../../pipeline/validate.py, ../../pipeline/regions.py]
---

**15 Nov rebuild (burncal-dxk, burncal-wp4):** January 2012 is now back-cast and stays out of the fit and validation (FIRMS S-NPP starts 20 Jan 2012; the 12-day month had pulled January factors low, Argentina Jan 2012 VIIRS/MODIS 0.98 vs 2.8-3.9 in 2013-2019). Sensor gaps of 4+ days found in the detection files were added to `data/outages.csv`. Only January back-cast months changed (and December where the season-level fallback pools DJF). Tables below are from that rebuild.

All numbers computed on 14 Nov 2026 from FIRMS SP country CSVs (MODIS 2000-2025, VIIRS S-NPP 2012-2025), `type == 0`, static filter, IGN provinces ([boundaries.md](boundaries.md)).

## Data

- Detections: 4,480,713 after `type == 0`; the static filter drops 35,116 in 739 sensor-year-cells (VIIRS 32,719 in 621, MODIS 2,397 in 118).
- MODIS `version` by year is the same as in Greece: 6.2 2000-2017, 6.03 2018-2022, 61.03 2023-2025.
- Province assignment (IGN `ign:provincia`, simplified to 0.001°, 4,103,980 unique points on a 0.001° grid): 4,445,589 assigned, 5,927 unique points by nearest province within 5 km, 8 detections unassigned.
- `acq_date` is UTC; at UTC-3 some night detections fall on the next calendar day. Not corrected; negligible at monthly resolution, listed as a limit.

## National harmonization (region `AR`)

- LOYO over 2012-2019: annual totals median absolute error 1.5 % (worst 2012, +13.9 %); monthly r 0.986, bias 0.0 %, RMSE log1p 0.164.
- Peak-month hit rate over 7 held-out season years: harmonized 1.0, raw MODIS vs VIIRS 0.857. Onset exact in 100 % of years (raw MODIS 86 %).
- Time split (fit 2012-2019, test 2020-2025): annual median absolute error 6.7 %, monthly bias -5.9 %. Worst year 2022, -14.8 %.
- Ratio trend 2012-2025: day +0.71 % per year, night -0.27 % per year (values per year in validation.json). No night decline as in Greece ([findings-greece.md](findings-greece.md)).
- Fit window gap: +3.1 %, above the LOYO error of 1.5 %. By the decided rule the back-cast uses the 2012-2019 fit.

## Provinces

| in1 | name | mode | LOYO MdAPE % | peak hit harm / raw | time split MdAPE % | fit gap % |
|---|---|---|---|---|---|---|
| 02 | Ciudad Autónoma de Buenos Aires | relative | 115.6 | 0.0 / 0.0 | 100.0 | 3.4 |
| 06 | Buenos Aires | harmonized | 8.1 | 0.714 / 0.857 | 22.4 | 12.3 |
| 10 | Catamarca | harmonized | 12.8 | 1.0 / 0.857 | 15.0 | -8.3 |
| 14 | Córdoba | harmonized | 10.4 | 1.0 / 1.0 | 5.7 | 1.1 |
| 18 | Corrientes | harmonized | 7.2 | 0.857 / 1.0 | 4.7 | 3.6 |
| 22 | Chaco | harmonized | 2.3 | 1.0 / 1.0 | 8.3 | -2.8 |
| 26 | Chubut | harmonized | 12.8 | 0.857 / 0.714 | 33.6 | -13.8 |
| 30 | Entre Ríos | harmonized | 6.5 | 1.0 / 1.0 | 11.5 | -1.7 |
| 34 | Formosa | harmonized | 2.3 | 1.0 / 1.0 | 4.2 | 1.6 |
| 38 | Jujuy | harmonized | 5.6 | 0.714 / 0.429 | 18.1 | 9.5 |
| 42 | La Pampa | harmonized | 6.4 | 0.714 / 0.714 | 4.0 | -0.7 |
| 46 | La Rioja | harmonized | 13.0 | 0.714 / 0.714 | 9.0 | -4.5 |
| 50 | Mendoza | harmonized | 9.3 | 0.857 / 0.714 | 20.0 | 8.0 |
| 54 | Misiones | harmonized | 2.3 | 1.0 / 1.0 | 11.6 | -4.7 |
| 58 | Neuquén | harmonized | 20.5 | 0.714 / 0.857 | 25.8 | 1.7 |
| 62 | Río Negro | harmonized | 6.3 | 0.571 / 0.571 | 7.6 | 0.7 |
| 66 | Salta | harmonized | 7.2 | 0.857 / 1.0 | 7.5 | 11.4 |
| 70 | San Juan | harmonized | 7.6 | 1.0 / 0.714 | 6.5 | 2.7 |
| 74 | San Luis | harmonized | 3.9 | 0.857 / 0.714 | 7.0 | -2.8 |
| 78 | Santa Cruz | harmonized | 15.1 | 0.714 / 0.714 | 13.1 | -7.2 |
| 82 | Santa Fe | harmonized | 4.6 | 1.0 / 1.0 | 7.9 | 3.2 |
| 86 | Santiago del Estero | harmonized | 3.8 | 0.857 / 0.857 | 9.0 | -2.7 |
| 90 | Tucumán | harmonized | 7.5 | 1.0 / 1.0 | 2.8 | -0.5 |
| 94 | Tierra del Fuego, Antártida e Islas del Atlántico Sur | relative | 62.1 | 0.143 / 0.143 | 60.1 | 140.2 |

- 22 of 24 provinces are `harmonized`. CABA (02) and Tierra del Fuego (94) are `relative` on the error threshold (very few detections). Neuquén (58) was `relative` until the 15 Nov rebuild (LOYO 26.5 %); without the partial January 2012 its LOYO error is 20.5 % and its peak-hit rate 5 of 7 vs raw MODIS 6 of 7, so it is `harmonized` now. Its time split error is 25.8 %. Under the original rule Corrientes (18) and Salta (66) were also `relative`, on one season year.

## Stress years

- Entre Ríos (Paraná Delta), season year 2020 (Dec 2019 to Nov 2020): 39,311 VIIRS detections, the highest of the record; next highest 2022 with 22,422. Every month from Feb to Dec 2020 is flagged as an anomaly (above the 90th percentile of the preceding 10 years); August 2020 alone has 16,492.
- Corrientes 2022: January (16,292 VIIRS; 3,435 MODIS) and February (26,213 VIIRS; 6,526 MODIS) 2022 flagged as anomalies.

## 2026, Jan-Oct (area API)

National VIIRS counts after filters, against the median of the same month in 2016-2025 (`web/public/data/v1/ar/regions/AR.json`, built 14 Nov 2026). Aug-Oct are NRT and provisional.

| Month | VIIRS | Median 2016-2025 | Percentile |
|---|---|---|---|
| Jan | 12,349 | 12,966 | 50 |
| Feb | 8,228 | 10,256 | 40 |
| Mar | 5,068 | 9,033 | 10 |
| Apr | 1,846 | 3,582 | 20 |
| May | 4,289 | 3,789 | 70 |
| Jun | 3,393 | 5,504 | 10 |
| Jul | 6,696 | 10,529 | 0 |
| Aug (NRT) | 8,904 | 35,841 | 0 |
| Sep (NRT) | 25,382 | 36,529.5 | 30 |
| Oct (NRT) | 5,161 | 20,512 | 0 |

The 2026 winter-spring season is the weakest of the record in July, August and October. July loses 6 days to the S-NPP gap; August and October have no gap in both countries, and the NRT file has 91 of 92 days. Not yet checked against SNMF reports. Months to Dec 2025 and all validation numbers are unchanged by the 2026 addition.

## Ablation and band coverage (15 Nov, audit round 3)

Same tests for three models: ours (region x month x day/night with fallbacks), one constant VIIRS/MODIS ratio `k`, and one ratio per calendar month; all fitted on Feb 2012 - Dec 2019. Time split = held-out 2020-2025, LOYO = 2012-2019. Band coverage = share of the 72 held-out 2020-2025 months whose observed VIIRS lies inside the back-cast band (nominal 80 %). Data: `validation.json`, fields `baselines` and `band_coverage`.

| id | mode | time split ours | constant | per month | LOYO ours | constant | per month | k | band coverage % |
|---|---|---|---|---|---|---|---|---|---|
| AR | harmonized | 6.7 | 7.5 | 6.6 | 1.5 | 2.9 | 2.3 | 3.298 | 61.1 |
| 02 | relative | 100.0 | 100.0 | 100.0 | 115.6 | 78.8 | 83.8 | 1.417 | 88.9 |
| 06 | harmonized | 22.4 | 29.9 | 27.9 | 8.1 | 14.0 | 13.0 | 2.578 | 54.2 |
| 10 | harmonized | 15.0 | 25.3 | 23.9 | 12.8 | 4.4 | 10.4 | 4.336 | 69.4 |
| 14 | harmonized | 5.7 | 9.2 | 5.0 | 10.4 | 16.2 | 13.8 | 3.333 | 66.7 |
| 18 | harmonized | 4.7 | 18.3 | 14.4 | 7.2 | 6.6 | 5.6 | 3.054 | 59.7 |
| 22 | harmonized | 8.3 | 5.7 | 5.3 | 2.3 | 4.3 | 2.8 | 3.201 | 65.3 |
| 26 | harmonized | 33.6 | 29.8 | 30.7 | 12.8 | 17.3 | 23.4 | 4.463 | 68.1 |
| 30 | harmonized | 11.5 | 18.7 | 17.8 | 6.5 | 12.4 | 10.7 | 3.161 | 76.4 |
| 34 | harmonized | 4.2 | 4.5 | 4.0 | 2.3 | 4.5 | 1.9 | 3.318 | 76.4 |
| 38 | harmonized | 18.1 | 14.0 | 16.9 | 5.6 | 13.4 | 7.6 | 3.111 | 68.1 |
| 42 | harmonized | 4.0 | 13.1 | 4.1 | 6.4 | 13.5 | 12.4 | 3.873 | 68.1 |
| 46 | harmonized | 9.0 | 7.9 | 12.0 | 13.0 | 19.9 | 11.5 | 4.013 | 80.6 |
| 50 | harmonized | 20.0 | 21.6 | 19.4 | 9.3 | 12.6 | 9.7 | 3.174 | 52.8 |
| 54 | harmonized | 11.6 | 7.0 | 7.8 | 2.3 | 2.7 | 3.1 | 3.381 | 75.0 |
| 58 | harmonized | 25.8 | 22.9 | 20.4 | 20.5 | 10.6 | 9.1 | 4.855 | 77.8 |
| 62 | harmonized | 7.6 | 6.5 | 8.0 | 6.3 | 12.7 | 11.8 | 3.752 | 76.4 |
| 66 | harmonized | 7.5 | 7.2 | 6.6 | 7.2 | 10.3 | 9.7 | 3.386 | 68.1 |
| 70 | harmonized | 6.5 | 7.6 | 3.0 | 7.6 | 9.7 | 8.1 | 3.462 | 72.2 |
| 74 | harmonized | 7.0 | 7.1 | 6.0 | 3.9 | 6.5 | 3.9 | 3.303 | 70.8 |
| 78 | harmonized | 13.1 | 22.4 | 19.7 | 15.1 | 18.7 | 22.3 | 4.812 | 87.5 |
| 82 | harmonized | 7.9 | 10.9 | 10.3 | 4.6 | 2.9 | 2.6 | 3.408 | 73.6 |
| 86 | harmonized | 9.0 | 8.6 | 9.0 | 3.8 | 7.1 | 6.0 | 3.145 | 76.4 |
| 90 | harmonized | 2.8 | 5.4 | 3.8 | 7.5 | 6.0 | 5.1 | 3.062 | 59.7 |
| 94 | relative | 60.1 | 27.7 | 49.7 | 62.1 | 31.6 | 40.9 | 6.11 | 93.1 |

- Ours is best on the time split in 8 of 22 harmonized regions and on LOYO in 15 of 22. Median time split over those regions: ours 8.65 %, constant 10.05 %, per month 9.65 %.
- Band coverage over harmonized regions: median 70.1 %, range 52.8-87.5 %; the band is narrower than its nominal 80 % in most regions, so it is a "likely range", not a calibrated interval.
- The validation season window now comes from MODIS 2001-2011 (`season_start_month_validation`); peak hit rates changed: 78 0.571 / 0.571 -> 0.714 / 0.714, 82 0.857 / 0.857 -> 1.0 / 1.0. No region changed mode.
