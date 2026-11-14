---
title: Challenge
updated: 2026-11-13
verified_by: Space Apps 2026 challenge list (pasted 11 Nov 2026); challenge author video (transcript pasted 11 Nov 2026)
sources: [sources/2026-11-11-challenge-video.md]
---

**Name:** Harmonization of MODIS and VIIRS Hot Spots. NASA Space Apps 2026, difficulty Intermediate/Advanced, subjects Earth Science and Software. The team (Spearow: Petr, Vita) is registered at the Thessaloniki local event, 14-15 Nov 2026.

**Author:** CONAE, the Argentine space agency, at the Teófilo Tabanera Space Center in Córdoba. The author's name in the auto-transcript, "Marina Companuchi", is likely wrong (UNVERIFIED, see [open-questions.md](open-questions.md)).

## Official short text

> Your challenge is to build a web application that harmonizes these records into a burning activity calendar based on active fire hotspots, enabling early warning and emergency responders, scientists, and land managers to examine historical fire patterns, unusual conditions, and critical periods within a selected area of interest.

## What the author video adds

- **Users:** the author's team does early warning and emergency response worldwide. About half of the emergencies they handle are fires, from forest wildfires and from agriculture, industry or land clearing.
- **Burning activity calendar,** also called a fire activity calendar: hotspot counts per month across years for one area. It shows trends, anomalies and seasonal patterns.
- **The problem:**
  - MODIS and VIIRS differ in resolution, sensitivity and observation times.
  - MODIS is ending and VIIRS replaces it.
  - Without a method that links the two, "almost 10 years of historical information will be lost".
- **Part 1, harmonization:** it should not matter which sensor a hotspot came from.
- **Part 2, web app:**
  - the user picks a date and a region,
  - sees that region's fire activity history,
  - can download analytics.
- **Data sources:** NASA FIRMS, plus resources from CONAE and other agencies, listed in the challenge Resources tab. We have not read that tab yet.
- Other approaches are explicitly welcome.

## What we deliver

- **Web app:**
  - region map,
  - year × month calendar heatmap with a MODIS / VIIRS / harmonized toggle,
  - season summary: peak, onset, end, length,
  - anomaly flags,
  - CSV export.
- **Method:** harmonization with a validation number from leave-one-year-out.
- **Repo:** a pipeline that reproduces everything from the FIRMS download onward.
- **Regions:** Greece first, Argentina second (the author's country).
- Details: [decisions.md](decisions.md), [space-apps-rules.md](space-apps-rules.md).
