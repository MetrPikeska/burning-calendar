# MODIS and VIIRS hot spot harmonization: research notes

Checked 2026-11-11. Sources are primary where possible (NASA FIRMS docs, product user guides, peer-reviewed papers). Anything we could not confirm is marked **UNVERIFIED**.

## What this changes in the build

- **Data:** use the FIRMS country CSVs for MODIS (2000-2025) and VIIRS S-NPP (2012-2025). They are public and need no key; Greece is 11 MB in total. NOAA-20/21 are API-only, so add them only if we need 2026.
- **Anchor:** MODIS is the anchor, because it is the only sensor covering 2000-2025. Express VIIRS-era activity in "MODIS-equivalent" units, or express MODIS in VIIRS units, so the 2012 sensor jump disappears. The Greek ratio is stable from year to year (see the data check below), so a monthly scaling factor fitted on 2012-2025 works at national and regional level.
- **Day and night:** fit them separately. The night ratio is about twice the day ratio.
- **Resolution:** do not harmonize single 0.1° cells month by month. That gave r² 0.23, and 73% of cell-months with a VIIRS detection have no MODIS one. Harmonize per region × month, or over a smoothed or longer window.
- **Units:** report counts and FRP side by side. For cropland burning, the FRP sums of the two sensors match almost 1:1. For large wildfires, VIIRS FRP is lower.
- **Calendar output:** peak month, onset and end (10% and 90% of the cumulative annual curve), per region.
- **Story hook:** the two sensors give different calendars for the same plain. In Thessaly the peak month is October in MODIS and July in VIIRS, because VIIRS sees small wheat-stubble fires.

## Challenge

- Page: https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/. It failed TLS verification from our machine, so the text is **UNVERIFIED**. Copy it from a browser.
- Other teams' GitHub repos (not primary) say CONAE wrote the challenge and that it asks for a "burning activity calendar". **UNVERIFIED.**

## Data products

| Product | Record | Source |
|---|---|---|
| MODIS C6.1 Terra | from 1 Nov 2000 | [FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq) |
| MODIS C6.1 Aqua | from Jul 2002 | FIRMS FAQ |
| VIIRS 375 m S-NPP (VNP14IMG) | 20 Jan 2012 to 2 Nov 2026 | [VIIRS UG 1.2](https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf), [LANCE blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-noaa-20-noaa-21-what-lance-users-need-know) |
| VIIRS NOAA-20 (VJ114IMG) | from 1 Apr 2018 | FIRMS FAQ, [Download tool](https://firms.modaps.eosdis.nasa.gov/download/) |
| VIIRS NOAA-21 (VJ214IMG) | 17 Jan 2024 (FAQ) or 1 Mar 2023 (Download tool), conflicting | same |

- **S-NPP has ended.** "Delivery of new science data from the Suomi NPP satellite ceased at 15:40 UTC on November 2, 2026" ([LANCE blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-noaa-20-noaa-21-what-lance-users-need-know)). An Earthdata alert gives 13:00 UTC ([alert](https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-observations-cease-november-2-2026)).
- **MODIS is ending.** "NASA plans to stop science data collection from the Aqua MODIS instrument around August 2026 and from the Terra MODIS instrument around January 2027" ([LAADS](https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/MODIS-VIIRS_Transition.pdf), [alert](https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs)). Whether Aqua actually stopped is **UNVERIFIED**.
- **Standard vs NRT.** SP (standard) is the consistent research record, with a 2-3 month lag. NRT is for rapid response and lacks the `type` attribution (FIRMS FAQ). Use SP.

### Access

- **Country CSVs**, no key, tested:
  - `https://firms.modaps.eosdis.nasa.gov/data/country/modis/{YYYY}/modis_{YYYY}_Greece.csv` covers 2000-2025. 2026 returns 404.
  - `.../country/viirs-snpp/{YYYY}/viirs-snpp_{YYYY}_Greece.csv` covers 2012-2025.
  - All-country zips exist at `.../data/country/zips/`.
  - NOAA-20/21 country files return 404 under every pattern we tried.
- **Area API:** `/api/area/csv/[MAP_KEY]/[SOURCE]/[w,s,e,n]/[1-5 days]/[YYYY-MM-DD]`. It has `*_SP` and `*_NRT` sources for MODIS, SNPP, NOAA20 and NOAA21. A free MAP_KEY gives 5000 transactions per 10 min ([API](https://firms.modaps.eosdis.nasa.gov/api/area/)).
- **Archive Download Tool:** SHP, CSV or JSON. It runs asynchronously and sends the result by email ([Download](https://firms.modaps.eosdis.nasa.gov/download/)).

### Columns

- MODIS columns: `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`. VIIRS uses the same set, with `bright_ti4` and `bright_ti5` in place of the two brightness columns.
- **Confidence.** MODIS reports 0-100: low <30, nominal 30-80, high ≥80 ([MODIS C6/C6.1 UG](https://earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf), Table 11). VIIRS reports the classes `l`, `n` and `h` (VIIRS UG).
- **type:** "0 = presumed vegetation fire, 1 = active volcano, 2 = other static land source, 3 = offshore" (both guides).
- **VIIRS type bug.** Product versions 1 and 2 left some static sources as type 0. The bug was fixed in May 2025 with v3 (VIIRS UG §6.1). The Greek country files are `version 2`, so we keep our own static filter.
- **frp** is in MW.
- **scan/track** is pixel size in km, along-scan and along-track. MODIS is 1 km at nadir and grows toward the swath edge. VIIRS stays roughly constant (FIRMS FAQ).
- **daynight.** In SP data, night means solar zenith > 85° (FIRMS FAQ).

## Sensor differences

- **Pixel size:** MODIS 1 km at nadir, much larger at the swath edge. VIIRS I-band 375 m, more uniform (FIRMS FAQ).
- **Overpass, nominal:** Terra about 10:30 / 22:30, Aqua about 13:30 / 01:30, S-NPP 13:30 / 01:30. NOAA-20/21 cross about 50 min earlier than S-NPP (FIRMS FAQ).
- **Orbit drift:**
  - Terra stopped orbit maintenance in Feb 2020 and has been drifting earlier.
  - Aqua has drifted later since Jul 2021 ([MODIS Land news](https://modis-land.gsfc.nasa.gov/news.html), [NTRS poster](https://ntrs.nasa.gov/api/citations/20250000522/downloads/AGU24_Terra_25years_MODIS_geometry_poster_GLin.pdf)).
  - In the 2025 Greek data, Terra daytime detections cluster at 07-09 UTC.
- **Detection limit:** MODIS routinely detects fires of about 1000 m², and about 100 m² of flaming fire under good conditions ([MODIS UG §8.3.2](https://earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf)). We found no official VIIRS minimum detectable FRP: **UNVERIFIED**.
- **MODIS gaps:**
  - Terra was inoperable in Sep 2000.
  - Aqua had an outage from 16 Aug to 2 Sep 2020 (MODIS UG §7.2.4, §8.3.3).

## Published methods

| Paper | Finding | Use for us |
|---|---|---|
| Schroeder et al. 2014, RSE 143:85, [doi:10.1016/j.rse.2013.12.008](https://doi.org/10.1016/j.rse.2013.12.008) | The VIIRS 375 m algorithm. It finds about 3x more fire pixels by day and 25x more at night than VIIRS 750 m. | Fit day and night separately. |
| Giglio, Schroeder & Justice 2016, RSE 178:31 ([PDF](https://www.earthdata.nasa.gov/s3fs-public/imported/Giglio2016_C6_Fire.pdf)) | The MODIS C6 algorithm. Daytime commission error is 1.2%. | Confidence classes. |
| Li et al. 2018, JGR-Atmos., [doi:10.1029/2017JD027823](https://doi.org/10.1029/2017JD027823) | MODIS and VIIRS FRP agree at cluster scale, except in large boreal fires where VIIRS reads about 47% lower. MODIS FRP depends on view angle. | Prefer FRP sums. Expect VIIRS to read low on big fires. |
| Vadrevu & Lasko 2018, Remote Sens. 10:978, [doi:10.3390/rs10070978](https://doi.org/10.3390/rs10070978) | Punjab residue burning. VIIRS counts are 4.8-6.5x MODIS. A monthly regression on the overlap extends the record back to 2003. Monthly FRP r² is 0.98. | **Closest precedent.** |
| Giglio et al. 2006, ACP 6:957, [link](https://acp.copernicus.org/articles/6/957/2006/) | Calibrates fire counts to burned area with regression trees stratified by tree cover, herbaceous cover and cluster size. | Template for a stratified transfer function. |
| Chen et al. 2023 (GFED5), ESSD 15:5227, [link](https://essd.copernicus.org/articles/15/5227/2023/) | Filters MODIS detections to confidence ≥30 and scan ≤30°, and applies scalars per region × land cover. | Filter choice. |
| Remote Sens. 12(18):2870, [link](https://mdpi.com/2072-4292/12/18/2870), authors **UNVERIFIED** | In Northeast Asia, MODIS misses 65% of VIIRS fire pixels in forest and 83% on low-biomass land. | Land-cover dependence. |
| VNP14A1 V2, [catalog](https://www.earthdata.nasa.gov/data/catalog/lpcloud-vnp14a1-002) | VIIRS 750 m, which replicates the MODIS C6 algorithm for continuity. | Possible baseline. |

## Fire calendar definitions

- Giglio et al. 2006, JGR ([PDF](https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/material3os/2006_Giglio_etal_GlobalDistribuiton_JGR_DE3os.pdf)): peak month, fire season length and periodicity from MODIS fire pixels.
- Korontzi et al. 2006, GBC 20:GB2021, [doi:10.1029/2005GB002529](https://doi.org/10.1029/2005GB002529): global cropland burning from MODIS monthly counts on a cropland mask. Peaks fall in Apr-May and August.
- Magi et al. 2012, Biogeosciences 9:3003, [doi:10.5194/bg-9-3003-2012](https://doi.org/10.5194/bg-9-3003-2012): splits agricultural from non-agricultural fire seasonality. Their exact onset definition is **UNVERIFIED**.
- Remote Sens. 6(5):4061, [doi:10.3390/rs6054061](https://doi.org/10.3390/rs6054061): onset, peak and length differ between fire products.
- **Our definition, a synthesis rather than any one paper's:**
  - Peak month is the argmax of the monthly climatology.
  - Onset and end are the months where the cumulative annual curve crosses 10% and 90%.
  - Duration is end minus onset.

## Greece

- **Zervaki, Grillakis & Voulgarakis 2026**, EGUsphere preprint ([egusphere-2026-4576](https://egusphere.copernicus.org/preprints/2026/egusphere-2026-4576/)):
  - MODIS MCD64A1 burned area is 41% above Hellenic Fire Service records for 2002-2023, but only 12% above on natural land cover.
  - Cropland burning in Thessaly-Central Greece and Macedonia-Thrace causes the excess. Fire Service records do not capture it.
  - The difference peaks in Sep-Oct.
- **CAP conditionality GAEC 3** is the "Ban on burning arable stubble, except for plant health reasons", Reg. (EU) 2021/2115 Annex III ([EUR-Lex](https://eur-lex.europa.eu/eli/reg/2021/2115/oj)). We confirmed the wording only in a 2026 Council draft.
- **March 2025:** more than 70 fires in one day, mostly crop residue burning, led to a temporary nationwide ban ([To Vima](https://www.tovima.com/society/greece-bans-burning-of-crops-following-70-wildfires-on-tuesday/amp), secondary).
- **Evros/Dadia 2023:** the largest single wildfire in the EU since EFFIS records began, about 81,000 ha ([phys.org/AFP](https://phys.org/news/2023-08-greece-blaze-largest-wildfire-eu.pdf)). Areas for 2007 and 2021: take them from the EFFIS annual reports. **UNVERIFIED.**
- **Land cover:**
  - CORINE Land Cover, 100 m, 2000/2006/2012/2018 (https://land.copernicus.eu/en/products/corine-land-cover). Arable classes are 211-213 and heterogeneous agriculture 241-244.
  - ESA WorldCover 10 m, 2020 ([doi:10.5281/zenodo.5571936](https://doi.org/10.5281/zenodo.5571936)) and 2021 ([doi:10.5281/zenodo.7254221](https://doi.org/10.5281/zenodo.7254221)).

## First data check: Greece, 2012-2025 overlap

Script: `scripts/ratio_check.py`. Inputs are the FIRMS country CSVs.

Filters:
- Keep `type == 0` only.
- Drop "static" detections: 0.01° cells seen on ≥16 distinct days in a year. This removed 33 MODIS and 165 VIIRS detections.

What the raw data looks like:
- VIIRS marks 13,508 detections as type 2 (18%), compared with 426 for MODIS.
- The MODIS scan ≤30° filter (scan ≤1.42 km) removes 40% of MODIS detections. That is too costly for a small country, so we keep all scan angles.

**Detection ratios**

| Comparison | Day | Night | All |
|---|---|---|---|
| VIIRS / MODIS (Terra+Aqua), no conf filter | 3.14 | 4.50 | 3.47 |
| VIIRS / Aqua (same overpass time) | 5.08 | 11.30 | 6.16 |

- **Yearly V/MODIS** ranges from 3.10 to 4.01 and **V/Aqua** from 5.57 to 7.17. Both are stable, including the big fire years 2021 and 2023.
- **Monthly national correlation** is r² 0.97 for counts and 0.96 for FRP sums.
- **Cell-level is noisy.** At 0.1° cell × month, log-log r² is only 0.23. 73% of cell-months with a VIIRS detection have no MODIS detection.

**Regions**

| Region | n ratio | FRP ratio V/M | Peak month MODIS / VIIRS |
|---|---|---|---|
| Central Macedonia plain | 3.63 | 1.01 | Oct / Oct |
| Thessaly plain | 3.78 | 0.76 | Oct / Jul |
| Evros | 3.25 | 0.60 | Aug / Aug |
| Attica | 3.53 | 0.48 | Aug / Aug |

- **Central Macedonia has two burning seasons:** Jan-Mar and Oct-Nov. Both look like agricultural or residue burning, and summer is quiet.
- **Nationally, August dominates** with wildfires.
