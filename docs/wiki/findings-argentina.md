---
title: Findings, Argentina
updated: 2026-11-14
verified_by: uv run python pipeline/build.py --country AR; numbers from web/public/data/v1/ar/validation.json (method v1-region-month-dn-loyo)
sources: [../../pipeline/build.py, ../../pipeline/validate.py, ../../pipeline/regions.py]
---

All numbers computed on 14 Nov 2026 from FIRMS SP country CSVs (MODIS 2000-2025, VIIRS S-NPP 2012-2025), `type == 0`, static filter, IGN provinces ([boundaries.md](boundaries.md)).

## Data

- Detections: 4,480,713 after `type == 0`; the static filter drops 35,116 in 739 sensor-year-cells (VIIRS 32,719 in 621, MODIS 2,397 in 118).
- MODIS `version` by year is the same as in Greece: 6.2 2000-2017, 6.03 2018-2022, 61.03 2023-2025.
- Province assignment (IGN `ign:provincia`, simplified to 0.001°, 4,103,980 unique points on a 0.001° grid): 4,445,589 assigned, 5,927 unique points by nearest province within 5 km, 8 detections unassigned.
- `acq_date` is UTC; at UTC-3 some night detections fall on the next calendar day. Not corrected; negligible at monthly resolution, listed as a limit.

## National harmonization (region `AR`)

- LOYO over 2012-2019: annual totals median absolute error 1.5 % (worst 2012, +13.9 %); monthly r 0.986, bias 0.0 %, RMSE log1p 0.164.
- Peak-month hit rate over 7 held-out season years: harmonized 1.0, raw MODIS vs VIIRS 0.857. Onset exact in 100 % of years (raw MODIS 86 %).
- Time split (fit 2012-2019, test 2020-2025): annual median absolute error 7.0 %, monthly bias -6.7 %. Worst year 2022, -16.7 %.
- Ratio trend 2012-2025: day +0.87 % per year (2.66-3.51), night +0.10 % per year (5.10-6.65). No night decline as in Greece ([findings-greece.md](findings-greece.md)).
- Fit window gap: +3.2 %, above the LOYO error of 1.5 %. By the decided rule the back-cast uses the 2012-2019 fit.

## Provinces

| in1 | name | mode | LOYO MdAPE % | peak hit harm / raw | time split MdAPE % | fit gap % |
|---|---|---|---|---|---|---|
| 02 | Ciudad Autónoma de Buenos Aires | relative | 114.5 | 0.0 / 0.0 | 100.0 | 4.0 |
| 06 | Buenos Aires | harmonized | 8.7 | 0.857 / 0.857 | 22.8 | 12.2 |
| 10 | Catamarca | harmonized | 13.2 | 1.0 / 0.857 | 13.1 | -7.7 |
| 14 | Córdoba | harmonized | 11.1 | 1.0 / 1.0 | 5.1 | 1.2 |
| 18 | Corrientes | relative | 7.3 | 0.857 / 1.0 | 4.6 | 3.4 |
| 22 | Chaco | harmonized | 2.8 | 1.0 / 1.0 | 7.7 | -2.8 |
| 26 | Chubut | harmonized | 11.8 | 0.857 / 0.714 | 19.2 | -7.2 |
| 30 | Entre Ríos | harmonized | 7.6 | 1.0 / 1.0 | 11.2 | -1.4 |
| 34 | Formosa | harmonized | 1.7 | 1.0 / 1.0 | 6.8 | 2.7 |
| 38 | Jujuy | harmonized | 5.2 | 0.714 / 0.429 | 18.1 | 9.5 |
| 42 | La Pampa | harmonized | 12.5 | 0.714 / 0.714 | 3.9 | -0.7 |
| 46 | La Rioja | harmonized | 10.5 | 0.714 / 0.714 | 9.1 | -4.5 |
| 50 | Mendoza | harmonized | 9.9 | 0.857 / 0.714 | 20.2 | 8.0 |
| 54 | Misiones | harmonized | 2.9 | 1.0 / 1.0 | 10.9 | -3.3 |
| 58 | Neuquén | relative | 26.5 | 0.571 / 0.857 | 21.6 | 4.2 |
| 62 | Río Negro | harmonized | 6.2 | 0.571 / 0.571 | 7.6 | 0.7 |
| 66 | Salta | relative | 7.1 | 0.857 / 1.0 | 7.8 | 11.6 |
| 70 | San Juan | harmonized | 7.6 | 1.0 / 0.714 | 6.5 | 2.6 |
| 74 | San Luis | harmonized | 6.1 | 0.714 / 0.714 | 6.2 | -2.7 |
| 78 | Santa Cruz | harmonized | 15.8 | 0.571 / 0.571 | 14.0 | -6.2 |
| 82 | Santa Fe | harmonized | 5.0 | 0.857 / 0.857 | 8.4 | 3.0 |
| 86 | Santiago del Estero | harmonized | 3.1 | 0.857 / 0.857 | 8.5 | -2.7 |
| 90 | Tucumán | harmonized | 7.4 | 1.0 / 1.0 | 2.8 | -0.5 |
| 94 | Tierra del Fuego, Antártida e Islas del Atlántico Sur | relative | 45.4 | 0.143 / 0.143 | 54.6 | 93.4 |

- 19 of 24 provinces are `harmonized`. CABA (02) and Tierra del Fuego (94) are `relative` on the error threshold (very few detections); Corrientes (18) and Salta (66) on one season year of the peak-hit rule; Neuquén (58) on both.

## Stress years

- Entre Ríos (Paraná Delta), season year 2020 (Dec 2019 to Nov 2020): 39,311 VIIRS detections, the highest of the record; next highest 2022 with 22,422. Every month from Feb to Dec 2020 is flagged as an anomaly (above the 90th percentile of the preceding 10 years); August 2020 alone has 16,492.
- Corrientes 2022: January (3,435 MODIS) and February (6,526 MODIS) 2022 flagged as anomalies. Corrientes is in `relative` mode, so the values are MODIS counts.
