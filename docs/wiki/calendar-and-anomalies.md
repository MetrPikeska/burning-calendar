---
title: Calendar metrics and anomalies
updated: 2026-11-13
verified_by: papers and portals linked below; the calendar definition is our own synthesis
sources: [sources/2026-11-13-research-harmonization-validation.md, sources/2026-11-11-research-modis-viirs.md, sources/2026-11-13-research-anomalies-rules.md, sources/2026-11-13-research-conae-argentina.md]
---

## Calendar

- **Core view:** a year × month matrix of harmonized hotspot counts for one region. This is what the challenge author describes ([challenge.md](challenge.md)).
- **Season metrics and their citations:**
  - Onset and end: the first months where the cumulative within-year count reaches 10% and 90%. Duration is the number of periods between them. This is the definition of Freeborn, Cochrane & Wooster 2014, [doi:10.3390/rs6054061](https://doi.org/10.3390/rs6054061), who also use a 25/75% "core season".
  - Peak month: the calendar month with the highest mean count. Giglio, Csiszar & Justice 2006, [doi:10.1029/2005JG000142](https://doi.org/10.1029/2005JG000142).
  - Giglio's season length is a different metric: the number of months with at least 10% of the mean annual count. Giglio excludes cells with fewer than 5 fire pixels per year.
- **Check for bimodality.** Central Macedonia has two seasons, Jan-Mar and Oct-Nov.
- **Literature:**
  - Korontzi et al. 2006, [doi:10.1029/2005GB002529](https://doi.org/10.1029/2005GB002529), finds global cropland burning peaks in Apr-May and August.
  - Magi et al. 2012, [doi:10.5194/bg-9-3003-2012](https://doi.org/10.5194/bg-9-3003-2012), separates agricultural from non-agricultural seasonality, but gives **no numeric onset rule**, so do not cite it for one. For Europe it describes "a minor peak in April followed by a dip and then a sharp increase moving into July".

## How the sensor and the harmonization change season metrics

- **A single constant factor changes nothing relative:** peak month, 10/90 onset and end, duration and percent anomalies stay the same.
- **A factor that varies by calendar month moves them.** So does a day/night split, because the night share changes through the season. Example for Greece: if the agricultural months carry higher ratios than the summer wildfire months, the back-cast moves onset earlier and end later than raw MODIS shows. Our calendar output therefore depends on the stratification and must be validated ([harmonization.md](harmonization.md)).
- **Evidence from other products:**
  - Freeborn 2014: MODIS and ATSR agreed on season duration in under 21% of grid cells, and the more sensitive product gave an earlier start and a later end.
  - Giglio 2006: Terra and Aqua cross-correlate at about 0.9, and a 20% cloud correction did not change peak month or season length.
- **No study compares MODIS and VIIRS onset, peak or length directly.** Our 2012-2025 overlap would be the first. One example: Thessaly peaks in October in MODIS and in July in VIIRS ([findings-greece.md](findings-greece.md)).
- **Monthly bins:** one month is the smallest detectable shift. Report onset and end differences in months, plus the share of years with an exact match.

## Anomalies

- **Operational pattern:** compare the current period with the mean of the same period over the last 10 years, and add cumulative-season curves.
  - GWIS: cumulative fires against the 10-year average.
  - EFFIS: VIIRS/MODIS anomalies against a 2012-2021 baseline. The JRC 2026 page uses a 2006-2025 baseline.
  - JRC Africa Knowledge Platform: 10-day counts against the long-term mean of the same period.
- **INPE chart set to copy:**
  - current year against min/mean/max of past years, with the current year excluded and the current month flagged as partial,
  - cumulative monthly total,
  - CSV download.
- **Statistic:** monthly counts are skewed and often zero.
  - log1p z-score: reasonable, but we have no citation for it (UNVERIFIED as a standard).
  - Percentile rank of the month among the same month in other years.
  - Negative binomial model: used for monthly MODIS counts in Kenya, PLOS ONE 2024, [PMC10810550](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10810550/).
  - Trend test: Contextual Mann-Kendall on 156 months of MODIS counts (EGU2016-17227).
- **Context for judges:** Jolly et al. 2015, [doi:10.1038/ncomms8537](https://doi.org/10.1038/ncomms8537), reports global fire-weather season length up 18.7% over 1979-2013.

## Missing-data days

- Satellite outages produce zero detections that are not real zeros. Examples:
  - Aqua, 16 Aug to 2 Sep 2020,
  - Aqua, 10 Jul, 22 Jul and 12 Aug 2026 over South America (INPE).
- The calendar should mark months with known outages instead of showing them as quiet. INPE does the same.
