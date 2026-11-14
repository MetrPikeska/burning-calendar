---
title: Harmonization methods
updated: 2026-11-13
verified_by: DOIs below; our numbers in findings-greece.md from scripts/ratio_check.py
sources: [sources/2026-11-13-research-harmonization-validation.md, sources/2026-11-11-research-modis-viirs.md, sources/2026-11-13-research-anomalies-rules.md, sources/2026-11-13-research-conae-argentina.md]
---

## The problem

- VIIRS 375 m detects many more small and night fires than MODIS.
- A naive merged series jumps when VIIRS starts in 2012. The jump comes from the sensor change, not from more fire.
- The counts ratio is not constant. It depends on:
  - fire size and intensity: MODIS C6.1 FRP detection limit is 5.7 MW day / 3.7 MW night at swath centre, about 40 MW at the edge; VIIRS 375 m is 3.7 MW day / 0.7 MW night ([Sofiev & Kouznetsov 2026](https://doi.org/10.5194/gmd-19-10123-2026)),
  - land cover (cropland highest),
  - day vs night,
  - MODIS scan angle (pixel 1 km² at nadir, about 9.8 km² at the edge),
  - **MODIS orbit drift after 2020-2021** (see below).

## Options, simplest first

1. **Ratio scaling** per region × calendar month × day/night, fitted on the overlap. Compute it as a ratio of sums (Σ VIIRS / Σ MODIS), not a mean of yearly ratios.
2. **Regression with intercept or on log counts.** Jethva 2022 (Punjab, 2012-2021, [doi:10.3389/feart.2022.1047278](https://doi.org/10.3389/feart.2022.1047278)) fitted VIIRS = 3.56 × MODIS + 18,836 (rice season) and 1.47 × MODIS + 11,404 (wheat). The intercepts are small fires that only VIIRS sees, so a ratio through the origin can be wrong where small fires dominate. log1p(V) ~ log1p(M) follows Vadrevu & Lasko 2018.
3. **Empirical CDF / quantile matching** of monthly counts. No paper applies it to counts (checked twice). Kaur et al. 2019 ([doi:10.3390/rs11101205](https://doi.org/10.3390/rs11101205), confirmed in full text) maps off-nadir MODIS FRP to the near-nadir CDF and checks it against S-NPP: FRP, not counts.
4. **FRP sums** next to counts. FRP sums are less sensitive to pixel size. For Greek cropland the two sensors agree 1:1, while VIIRS reads low for big wildfires.

No paper compares ratio vs regression vs quantile mapping on counts. Running all three side by side on our strata would be our own contribution. Other Space Apps 2026 teams use quantile mapping and LightGBM (UNVERIFIED, their repos).

**Fallback hierarchy for thin strata:** region × month × day/night, then region × season (agricultural vs summer wildfire months) × day/night, then region × day/night, then national × day/night. Proposed threshold: at least 5 MODIS detections per year in the stratum (from the mask in Giglio et al. 2006, [doi:10.1029/2005JG000142](https://doi.org/10.1029/2005JG000142)) and at least 30 over the fitting years. Night strata will fall back most often. Argentina's night ratios are affected by the SAMA filter, so they should not be pooled with Greece's.

## Orbit drift inside the fitting window

- Terra's last inclination manoeuvre was on 27 Feb 2020, Aqua's on 18 Mar 2021 ([Twedt et al. 2023](https://ntrs.nasa.gov/api/citations/20240001409/downloads/2023_SPIE_Twedt_MODIS_EV_orbit_drift_manuscript_v4.pdf)). Both have since moved about 2 h from their nominal overpass ([sensors.md](sensors.md)).
- NASA's fire team says the impact on MODIS fire products "is under active investigation" (Giglio, May 2025). The Jan 2026 LDOPE issue gives no fire-specific number.
- Expected direction (inference, not measured): Terra moving towards 8:30 loses afternoon fires. Aqua first moved into the 14-15 h fire peak and then past it.
- Greek yearly ratios peak in 2021 ([findings-greece.md](findings-greece.md)). 2021 is both a megafire year and the first Aqua drift year, so the two causes cannot be separated.
- Leave-one-year-out cannot detect this, because every fold still trains on the drifted years.

## Validation protocol

Three tests:
1. **Leave-one-year-out** over the fitting years. Stress years: 2021 and 2023 for Greece (2021 is confounded with drift), and 2020 (Paraná Delta) and 2022 (Corrientes) for Argentina.
2. **Time split:** fit on 2012-2019, predict 2020-2025. This is the only test that exposes a drift artefact. If the 2012-2019 and 2012-2025 fits differ by more than the LOYO error, back-cast with the pre-drift fit, because MODIS 2000-2011 was observed at nominal orbits.
3. **Trend test** on the annual VIIRS/MODIS ratio per region × day/night (OLS slope or Mann-Kendall). Nobody has published one.

Metrics to report:
- **Monthly counts:** mean signed error % (bias), MAE, RMSE on log(1+count), Pearson r, RMA slope. GFED5NRT uses r, RMA slope, nRMSE and a Taylor skill score ([Chen et al. 2026, ESSD 18:7535](https://essd.copernicus.org/articles/18/7535/2026/)).
- **Annual totals:** per-year % error. Jethva 2022 reports this format, but for its NDVI-to-fire model, not for the VIIRS/MODIS conversion (checked in full text 13 Nov; the source report says otherwise).
- **Calendar, per held-out year and region:**
  - peak-month hit rate,
  - onset and end difference in months,
  - season length difference.

  Report raw MODIS vs VIIRS as the baseline ([calendar-and-anomalies.md](calendar-and-anomalies.md)).

Published validation is weaker than this. Jethva 2022 fitted its VIIRS/MODIS regression on all of 2012-2021 with no held-out years. GFED5NRT is in-sample only. Nobody has published LOYO or k-fold cross-validation for count harmonization.

## Reference scale

- MODIS ends in 2026/27 ([sensors.md](sensors.md)). After that only VIIRS is left.
- A VIIRS-equivalent series is therefore more useful than a MODIS-equivalent one: keep VIIRS as is from 2012 and back-cast 2000-2011 from MODIS with the fitted factor. GFED5NRT does the opposite, converting VIIRS into the MODIS-era record, fitted on 2012-2022 per 14 regions × 16 land-cover types.
- **Terra only, Nov 2000 to Jun 2002:** Aqua starts in Jul 2002, so this period needs its own Terra-only ratio.
- **INPE (Brazil):**
  - It keeps one reference satellite (Aqua MODIS afternoon) and has not switched. Aqua is still the reference in its 2026 notices.
  - Its FAQ says S-NPP VIIRS takes over "quando o satélite AQUA deixar de operar", with compatibility "ajustada cautelosamente". No method is published.
  - When INPE moved from NOAA-15 to Aqua in 2011, it spliced without calibration, arguing that the percent change over time stays the same ([related-tools.md](related-tools.md)).
- **Fallback if validation fails for a region:** show percent anomalies and relative calendar metrics, which a constant factor does not change, instead of harmonized absolute counts. This is the INPE approach.
- Decided 13 Nov 2026: VIIRS-equivalent, with the fit window rule, chained Terra-only factor and per-region `relative` fallback in [decisions.md](decisions.md).

## S-NPP to NOAA-20 splice

- S-NPP FIRMS production ended at 15:40 UTC on 2 Nov 2026 (FIRMS FAQ). NOAA-20 overlaps it from Apr 2018.
- NOAA STAR uses the same algorithm for all three VIIRS satellites. Only the FRP coefficient differs for NOAA-21 (about 10% higher FRP).
- No published count factor exists. The only numbers are global daytime fire pixels for 1-12 Mar 2023 ([NOAA-21 beta review](https://www.star.nesdis.noaa.gov/JPSS/documents/AMM/N21/NOAA-21_Active_Fires_Beta.pdf)): NOAA-20 at 0.988 of S-NPP, NOAA-21 at 0.918 (preliminary data). Use these as a sanity check only.
- "Compatible detections counts and FRP retrievals" in the 2018 NOAA-20 review is a validation criterion, not a finding.
- Fit our own factor per region × day/night on Apr 2018 to Oct 2026. NOAA-20 passes about 50 min before S-NPP, so where fires peak in the afternoon the NOAA-20 deficit can exceed the global 1.2%.
- The FIRMS API needs a MAP_KEY for NOAA-20, because there are no country CSVs.

## Precedents and filters

| Source | Finding | Use |
|---|---|---|
| Chen et al. 2026 (GFED5NRT), [ESSD 18:7535](https://essd.copernicus.org/articles/18/7535/2026/) | VIIRS counts to MODIS-era burned area, factor per 14 regions × 16 land-cover types, fit 2012-2022; scan-angle weights per day/night and month | Closest operational analogue; metric set |
| Jethva 2022, [doi:10.3389/feart.2022.1047278](https://doi.org/10.3389/feart.2022.1047278) | Punjab/Haryana seasonal regression with intercepts, fitted on 2012-2021: "3.56 (1.47) times more fire incidences with a positive offset of 18,836 (11,404)" for rice (wheat) | Regression challenger |
| Vadrevu & Lasko 2018, [doi:10.3390/rs10070978](https://doi.org/10.3390/rs10070978) | Punjab residue burning. VIIRS counts 4.8-6.5× MODIS; monthly overlap regression extends the record back to 2003; FRP r² 0.98 | Only published back-cast |
| Fu et al. 2020, [doi:10.3390/rs12182870](https://doi.org/10.3390/rs12182870) | Northeast Asia: MODIS misses 65% (forest) and 83% (low-biomass land) of VIIRS fire pixels in near-simultaneous passes | Omission rates, not a count factor |
| Li et al. 2018, [doi:10.1029/2017JD027823](https://doi.org/10.1029/2017JD027823) | FRP agrees at cluster scale. On 1° grids the difference is about 20% in fire-prone regions. MODIS FRP depends on view angle. VIIRS is about 47% lower in large boreal fires (UNVERIFIED, snippet). | Prefer FRP sums; expect VIIRS to read low on big fires |
| Schroeder et al. 2014, [doi:10.1016/j.rse.2013.12.008](https://doi.org/10.1016/j.rse.2013.12.008) | 375 m finds about 3× (day) and 25× (night) more fire pixels than VIIRS 750 m | Fit day and night separately |
| Csiszar et al. 2014, [doi:10.1002/2013JD020453](https://doi.org/10.1002/2013JD020453) | VIIRS 750 m: 26% more detections than MODIS within ±31° scan, 70% more outside | Scan angle effect |
| Chen et al. 2023 (GFED5), [ESSD 15:5227](https://essd.copernicus.org/articles/15/5227/2023/) | MODIS filtered to confidence ≥30 and scan ≤30°; scalars per land cover | Filter template; for Greece we rejected the scan filter |
| Giglio et al. 2006, [ACP 6:957](https://acp.copernicus.org/articles/6/957/2006/) | Count-to-area regression trees stratified by tree cover and cluster size | Template for stratification |
| Sofiev & Kouznetsov 2026, [doi:10.5194/gmd-19-10123-2026](https://doi.org/10.5194/gmd-19-10123-2026) | Analytical FRP operators between MODIS and VIIRS, with detection limits | FRP only |
| CAMS GFAS | v1.2 MODIS only 2003-2025, v1.4.2 MODIS + VIIRS from 1 Jan 2026, no cross-calibration described | A version break, not a method |
| VNP14A1 V2 (VIIRS 750 m, MODIS-like algorithm) | Built for continuity with MODIS | Possible baseline |

**Data version:** the VIIRS C2 monthly files of versions 1 and 2 labelled many static sources as `type 0`. NASA fixed this in May 2025 with version 3, C2.03 ([VIIRS C2 375 m UG v1.2 §6.1](https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf)). Our static-source filter covers this either way ([findings-greece.md](findings-greece.md)).
