---
title: MODIS and VIIRS sensors
updated: 2026-11-13
verified_by: FIRMS FAQ, MODIS C6/C6.1 Fire UG, VIIRS C2 375 m UG 1.2, LANCE/FIRMS blogs (URLs in sources)
sources: [sources/2026-11-13-research-harmonization-validation.md, sources/2026-11-11-research-modis-viirs.md, sources/2026-11-13-research-anomalies-rules.md]
---

## Mission status (Nov 2026)

- **S-NPP VIIRS** stopped on 2 Nov 2026. The FIRMS FAQ now says FIRMS production "ceased at 15:40 Universal Time (UTC)", which matches LANCE. An earlier read of FIRMS gave 13:00 UTC.
- **NOAA-20 and NOAA-21 VIIRS** continue. NASA calls them drop-in replacements for S-NPP: same sensor, same resolution, same products ([data-firms.md](data-firms.md)).
- **MODIS end dates disagree between sources:**
  - LAADS and NSIDC (2021 notices): Terra through December 2025, Aqua around August 2026.
  - CAMS (25 Feb 2026): Terra January 2027, Aqua around September 2027.
  - NASA Science: Terra February 2027, Aqua September 2027.
  - A May 2025 Aqua status report reportedly plans passivation on 4 Nov 2026 (UNVERIFIED, snippet).
  - The FIRMS FAQ still lists both as running "to the present".
  - Whether Aqua has actually stopped is UNVERIFIED.
- **Terra** is the only morning overpass left. NASA has not settled on a replacement (FIRMS blog, Nov 2026).

## Differences that matter for harmonization

| | MODIS (Terra, Aqua) | VIIRS 375 m (S-NPP, NOAA-20, NOAA-21) |
|---|---|---|
| Record | Terra from 1 Nov 2000, Aqua from Jul 2002 | S-NPP 20 Jan 2012 to 2 Nov 2026, NOAA-20 from 1 Apr 2018, NOAA-21 from 2023 or 2024 (sources conflict) |
| Pixel | 1 km at nadir, much larger at the swath edge | 375 m, roughly constant across the swath |
| Swath | about 2330 km | about 3040-3060 km |
| Overpass (nominal) | Terra ~10:30/22:30, Aqua ~13:30/01:30 | S-NPP ~13:30/01:30; NOAA-20/21 about 50 min earlier |
| Sensitivity | routinely detects fires of about 1000 m², about 100 m² under good conditions | many more small fires: NOAA cites 3-4× more daytime and about 20× more nighttime pixels than 750 m/MODIS |
| FRP | depends strongly on view angle | stable across the swath; I4 band often saturates near 367 K |

## Orbit drift

- **Terra:**
  - Last inclination manoeuvre 27 Feb 2020, last drag make-up manoeuvre 28 Jul 2022 ([Twedt et al. 2023](https://ntrs.nasa.gov/api/citations/20240001409/downloads/2023_SPIE_Twedt_MODIS_EV_orbit_drift_manuscript_v4.pdf)).
  - Equator crossing moves earlier: 8:32 am MLT at 693 km in Nov 2026 per [terra.nasa.gov](https://terra.nasa.gov/). The chart alt text on the same page says 9:59.
  - Our 2025 Greek data shows Terra daytime detections at 07-09 UTC.
- **Aqua:**
  - Last inclination manoeuvre 18 Mar 2021, last drag make-up manoeuvre 1 Dec 2021. NSIDC dates the drift from Jul 2021.
  - Overpass moves later: NSIDC projected about 15:50 by around Aug 2026. No 2026 primary source gives the current crossing time.
- **Effect on fire counts:** not quantified. Giglio (LANCE UWG, May 2025) lists diurnal sampling, pixel size, scan gaps and bowtie changes, and calls the impact "under active investigation". See [harmonization.md](harmonization.md) for what this means for the fitting window.

## Known MODIS gaps

- Terra was inoperable in Sep 2000.
- Aqua had an outage from 16 Aug to 2 Sep 2020.
- INPE logged days in 2026 when Aqua did not image part of South America: 10 Jul, 22 Jul and 12 Aug. See [calendar-and-anomalies.md](calendar-and-anomalies.md) on showing missing-data days.
