---
title: Personas
updated: 2026-11-14
verified_by: team decision 14 Nov 2026 (Petr), against the challenge page text
sources: [sources/2026-11-14-challenge-page.md, sources/2026-11-11-challenge-video.md, ../notes/2026-11-11-zadani.md]
---

Who the burning calendar is for. Decided by the team on 14 Nov 2026; Claude Code was used as a sparring partner (logged in `docs/si-use.md`). No interviews with real users: the personas come from the challenge text and the author video.

## The problem behind all personas

Every user needs a 20+ year baseline for their own area to compare a month or a season with, and that baseline breaks in 2012. Today they use one of three workarounds:

- MODIS only: the record ends with Terra and Aqua (2026/27) and misses small fires,
- VIIRS only: 2000-2011 is lost (the author's "almost 10 years of historical information"),
- both joined naively: a jump in 2012 that looks like record years but is a sensor change.

## Primary: early warning analyst

Example roles: the CONAE early warning and emergency response team in Córdoba (the challenge author's team); a regional civil protection analyst in Central Macedonia.

- **Job:** "Before and during the fire season, I want to know when the critical period starts in my region and whether a given month is unusual against 20+ years, so that I can plan monitoring and resources and brief the authorities."
- **Needs:** pick a region or enter lat/lon; year × month calendar; onset, peak and end of season as the headline numbers; the chosen month against the median of the preceding 10 years; CSV for a report.
- **Why primary:** the challenge page names "emergency managers" twice where it describes what the app should do ("compare the burning activity of the current month against the historical median"), the role is the author's own team, the demo already opens on Paraná ([decisions.md](decisions.md), 13 Nov) and the same role exists in Greece.
- **Weak spot:** the series ends Dec 2025, so "this month" (Nov 2026) is not covered. The demo frames the job as "pick any month and compare it with the median", for example Aug 2020 in the Paraná Delta or Aug 2023 in Evros. 2026 through NOAA-20 stays a stretch goal after Argentina and MCP.

## Secondary: land manager or agricultural regulator

Example roles: a regional agriculture directorate in Central Macedonia or Thessaly checking the GAEC 3 stubble-burning ban.

- **Job:** "I want to see when and where stubble burning concentrates and whether it drops over the years, so that I can target inspections and judge the ban."
- **Needs:** trend by season year, two seasons in bimodal regions, NUTS3 detail later.
- Gives the local story for the Thessaloniki jury. Our 2000-2025 series answers this job fully.

## Secondary: scientist

- **Needs:** harmonized series with uncertainty (`harm_lo`, `harm_hi`), fitted factors, LOYO validation, machine-readable access (JSON Schema, MCP, CSV).
- Served by README, one slide and the agent layer ([agent-access.md](agent-access.md)), not by the demo storyline.

## Not personas

- **Firefighter at an active fire:** named in the challenge page, but needs near-real-time detections, not a calendar.
- **Journalist or fact-checker:** used only as a pitch hook ("2012 is not a record year, it is a sensor change").

## What the personas add to the product

- Panel "chosen month vs median of the preceding 10 years". `anom_pct` already holds the percentile; the median is not shown in the UI yet.
- Critical period (onset, peak, end) as the headline line of the region summary.
- Lat/lon input mapped to a region (point-in-polygon in JS over `regions.geojson`).
- Accessible sequential colour ramp in the heatmap: inferno (same perceptually uniform family as viridis and cividis), one constant in `web/src/charts/heatmap.ts`.
- CSV stays monthly per region. A CSV of individual detections ("hot spots detected during a search") is an open question ([open-questions.md](open-questions.md)).
