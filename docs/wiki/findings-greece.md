---
title: Findings, Greece
updated: 2026-11-15
verified_by: uv run python pipeline/download_firms_api.py; uv run python pipeline/build.py --refresh --country GR; numbers from web/public/data/v1/gr/validation.json (method v1-region-month-dn-loyo)
sources: [../../pipeline/build.py, ../../pipeline/validate.py, ../../pipeline/harmonize.py]
---

**15 Nov rebuild (burncal-dxk, burncal-wp4):** January 2012 is now back-cast and stays out of the fit and validation (FIRMS S-NPP starts 20 Jan 2012; the 12-day month had pulled January factors low, Argentina Jan 2012 VIIRS/MODIS 0.98 vs 2.8-3.9 in 2013-2019). Sensor gaps of 4+ days found in the detection files were added to `data/outages.csv`. Only January back-cast months changed (and December where the season-level fallback pools DJF). Tables below are from that rebuild.

All numbers recomputed on 14 Nov 2026 from FIRMS SP country CSVs (MODIS C6.1 2000-2025, VIIRS S-NPP 2012-2025), `type == 0`, static filter. The pre-event numbers were not reused.

## Data

- Detections: 120,770 after `type == 0`; the static filter (0.01°, ≥16 days per year and sensor) drops 198 in 9 sensor-year-cells. Most static sources are already `type 2`.
- NUTS2 assignment (GISCO 2024 1:1M, coordinates deduplicated on a 0.001° grid, 115,609 unique points): 120,332 detections assigned, of which 1,416 unique points matched to the nearest region within 5 km (coast); 240 detections unassigned. Unassigned rows stay in the national series.
- MODIS `version` by year: 6.2 2000-2017, 6.03 2018-2022, 61.03 2023-2025. No ratio step at 2018 ([data-firms.md](data-firms.md)).
- National VIIRS/MODIS ratio 2012-2025, after filters: day 2.72-3.62, night 3.18-6.55.

## National harmonization (region `GR`)

- LOYO over 2012-2019: annual totals median absolute error 5.4 % (worst 2017, +11.8 %); monthly r 0.985, bias 0.0 %, RMSE log1p 0.278.
- Peak-month hit rate over 7 held-out season years: harmonized 0.857, raw MODIS vs VIIRS 0.571. Onset exact in 71 % of years (raw MODIS 43 %).
- Time split (fit 2012-2019, test 2020-2025): annual median absolute error 7.1 %, monthly bias +10.1 %. Errors grow after 2022: 2023 +22.9 %, 2024 +10.5 %, 2025 +17.9 % (prediction above VIIRS, so MODIS now sees relatively more per VIIRS detection than in 2012-2019).
- Night ratio trend 2012-2025: -3.3 % per year (5.14 in 2012, 3.18 in 2025). Day ratio flat (-0.06 % per year). Consistent with the orbit drift effect expected in [harmonization.md](harmonization.md), but 2023 is also an extreme fire year.
- Fit window gap: the 2000-2011 back-cast total with the 2012-2025 fit is 3.4 % lower than with the 2012-2019 fit, below the LOYO error. Rule outcome: back-cast with 2012-2019 (as decided).

## NUTS2 regions

| id | name | mode | LOYO MdAPE % | peak hit harm / raw | time split MdAPE % | fit gap % |
|---|---|---|---|---|---|---|
| EL30 | Attiki | harmonized | 16.1 | 0.857 / 0.857 | 18.1 | -3.4 |
| EL41 | Voreio Aigaio | harmonized | 9.7 | 1.0 / 0.857 | 23.7 | 0.1 |
| EL42 | Notio Aigaio | harmonized | 25.0 | 0.429 / 0.286 | 22.8 | -12.6 |
| EL43 | Kriti | harmonized | 13.9 | 0.714 / 0.714 | 15.8 | 1.5 |
| EL51 | Anatoliki Makedonia, Thraki | harmonized | 7.5 | 0.714 / 0.714 | 11.1 | 0.9 |
| EL52 | Kentriki Makedonia | harmonized | 4.0 | 1.0 / 1.0 | 11.8 | 0.5 |
| EL53 | Dytiki Makedonia | harmonized | 6.3 | 1.0 / 1.0 | 30.5 | -6.6 |
| EL54 | Ipeiros | harmonized | 24.2 | 0.571 / 0.429 | 31.9 | -10.3 |
| EL61 | Thessalia | harmonized | 4.2 | 0.714 / 0.857 | 19.5 | -6.1 |
| EL62 | Ionia Nisia | relative | 32.0 | 1.0 / 1.0 | 40.5 | 3.6 |
| EL63 | Dytiki Elláda | harmonized | 19.4 | 0.857 / 0.429 | 22.4 | -19.0 |
| EL64 | Sterea Elláda | harmonized | 16.3 | 0.714 / 0.857 | 13.0 | 18.5 |
| EL65 | Peloponnisos | harmonized | 17.5 | 1.0 / 0.857 | 16.1 | 9.8 |

- 12 of 13 regions are `harmonized`; EL62 Ionia Nisia is `relative` on the 25 % error threshold.
- Peak hit rates use 7 or 8 season years, so one year moves the rate by 0.125-0.143. Under the original rule (13 Nov) EL51, EL61 and EL64 were `relative` because of a single season year; the amended rule (14 Nov, [decisions.md](decisions.md)) allows one year of difference.
- EL42 sits exactly at the 25 % threshold and stays `harmonized`.
- Regional VIIRS/MODIS fit-window ratios range from 2.49 (EL64) to 4.21 (EL42).

## 2026, Jan-Oct (area API)

National VIIRS counts after filters, against the median of the same month in 2016-2025 (`web/public/data/v1/gr/regions/GR.json`, built 14 Nov 2026). Aug-Oct are NRT and provisional.

| Month | VIIRS | Median 2016-2025 | Percentile |
|---|---|---|---|
| Jan | 45 | 107.5 | 10 |
| Feb | 119 | 253.5 | 10 |
| Mar | 288 | 282.0 | 50 |
| Apr | 85 | 133.5 | 20 |
| May | 54 | 50.0 | 75 |
| Jun | 95 | 109.5 | 50 |
| Jul | 688 | 422.5 | 70 |
| Aug (NRT) | 1,172 | 1,011.5 | 70 |
| Sep (NRT) | 222 | 304.0 | 30 |
| Oct (NRT) | 524 | 618.5 | 40 |

No month of 2026 is an anomaly at the national level. March, April and July lose 3, 3 and 6 days to S-NPP gaps (`outage_viirs`). Adding 2026 left every month to Dec 2025 and every validation number unchanged; `annual_mean` moved in some regions because season year 2025 became complete.

## Ablation and band coverage (15 Nov, audit round 3)

Same tests for three models: ours (region x month x day/night with fallbacks), one constant VIIRS/MODIS ratio `k`, and one ratio per calendar month; all fitted on Feb 2012 - Dec 2019. Time split = held-out 2020-2025, LOYO = 2012-2019. Band coverage = share of the 72 held-out 2020-2025 months whose observed VIIRS lies inside the back-cast band (nominal 80 %). Data: `validation.json`, fields `baselines` and `band_coverage`.

| id | mode | time split ours | constant | per month | LOYO ours | constant | per month | k | band coverage % |
|---|---|---|---|---|---|---|---|---|---|
| GR | harmonized | 7.1 | 6.0 | 7.6 | 5.4 | 7.1 | 5.3 | 3.5 | 59.7 |
| EL30 | harmonized | 18.1 | 16.6 | 11.1 | 16.1 | 25.4 | 47.5 | 3.734 | 73.6 |
| EL41 | harmonized | 23.7 | 28.6 | 38.9 | 9.7 | 24.5 | 23.7 | 3.564 | 72.2 |
| EL42 | harmonized | 22.8 | 46.9 | 53.3 | 25.0 | 30.1 | 29.9 | 4.218 | 80.6 |
| EL43 | harmonized | 15.8 | 9.3 | 20.8 | 13.9 | 9.3 | 20.0 | 3.481 | 79.2 |
| EL51 | harmonized | 11.1 | 4.9 | 7.6 | 7.5 | 9.6 | 8.0 | 3.342 | 81.9 |
| EL52 | harmonized | 11.8 | 11.7 | 9.4 | 4.0 | 4.3 | 2.4 | 3.633 | 81.9 |
| EL53 | harmonized | 30.5 | 33.0 | 33.6 | 6.3 | 12.7 | 9.9 | 4.021 | 76.4 |
| EL54 | harmonized | 31.9 | 29.7 | 28.7 | 24.2 | 22.1 | 23.1 | 3.765 | 62.5 |
| EL61 | harmonized | 19.5 | 13.1 | 15.9 | 4.2 | 12.0 | 4.8 | 3.854 | 68.1 |
| EL62 | relative | 40.5 | 41.0 | 44.0 | 32.0 | 29.4 | 38.3 | 2.794 | 86.1 |
| EL63 | harmonized | 22.4 | 17.7 | 4.0 | 19.4 | 12.4 | 12.7 | 3.051 | 75.0 |
| EL64 | harmonized | 13.0 | 18.0 | 16.9 | 16.3 | 19.9 | 22.9 | 2.483 | 70.8 |
| EL65 | harmonized | 16.1 | 13.3 | 20.3 | 17.5 | 16.7 | 14.3 | 3.057 | 66.7 |

- Ours is best on the time split in 4 of 12 harmonized regions and on LOYO in 7 of 12. Median time split over those regions: ours 18.8 %, constant 17.15 %, per month 18.6 %.
- Band coverage over harmonized regions: median 74.3 %, range 62.5-81.9 %; the band is narrower than its nominal 80 % in most regions, so it is a "likely range", not a calibrated interval.
- The validation season window now comes from MODIS 2001-2011 (`season_start_month_validation`); peak hit rates changed: EL51 0.857 / 1.0 -> 0.714 / 0.714, EL52 0.857 / 0.857 -> 1.0 / 1.0. No region changed mode.
