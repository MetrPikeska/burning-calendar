---
title: Findings, Greece
updated: 2026-11-14
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
| EL51 | Anatoliki Makedonia, Thraki | harmonized | 7.5 | 0.857 / 1.0 | 11.1 | 0.9 |
| EL52 | Kentriki Makedonia | harmonized | 4.0 | 0.857 / 0.857 | 11.8 | 0.5 |
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
