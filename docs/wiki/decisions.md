---
title: Decisions
updated: 2026-11-13
verified_by: team discussion 11-13 Nov 2026, grilling session 13 Nov 2026; numbers in findings-greece.md
sources: [sources/2026-11-13-research-harmonization-validation.md, findings-greece.md, harmonization.md, sources/2026-11-11-research-modis-viirs.md]
---

## Made

| Date | Decision | Why |
|---|---|---|
| 11 Nov | Challenge: MODIS/VIIRS hotspots, not "Dancing with the SARs" | NISAR GCOV is about 20 GB behind a login, with an unverified HDF5 layout. FIRMS CSVs are public and small. The SAR code is kept in `archive/sar/`. |
| 11 Nov | Data: FIRMS country CSVs, SP data, MODIS 2000-2025 + S-NPP 2012-2025 | No key needed; consistent record |
| 11 Nov | Filters: `type == 0`, static filter (≥16 days per year in a 0.01° cell), no MODIS scan filter | Version-2 VIIRS files have a type bug. The scan filter would drop 40% of MODIS detections. |
| 11 Nov | Harmonize per region × month (× day/night), not per 0.1° cell | Cell-level r² is 0.23; the national and regional ratios are stable |
| 11 Nov | Greece first; Argentina second (after the author video) | Local story for Thessaloniki; Argentina is the author's country |
| 11 Nov | Must-haves: region + date selection, CSV export | Named in the author video |
| 11 Nov | Static web app with precomputed JSON, no FastAPI or PostGIS | Time budget; nothing needs a backend |
| 13 Nov | Reference scale: VIIRS-equivalent. VIIRS kept as is from 2012; 2000-2011 back-cast from MODIS | MODIS ends 2026/27 and only VIIRS remains; INPE plans the same direction. GFED5NRT goes the other way. |
| 13 Nov | Fit window rule: fit on 2012-2019 and 2012-2025; if they differ by more than the LOYO error, back-cast with 2012-2019 | MODIS 2000-2011 was observed at nominal orbits; drift starts 2020-2021 ([harmonization.md](harmonization.md)) |
| 13 Nov | Terra-only months (Nov 2000 to Jun 2002): chained factor, (T+A)/T fitted on 2003-2011, then V/(T+A); flagged `backcast_terra` | Avoids Terra drift in the overlap |
| 13 Nov | Fallback per region: mode `relative` when LOYO median absolute error of annual totals is above 25 %, or back-cast peak-month hit rate is worse than raw MODIS vs VIIRS | Fixed before seeing results. The 25 % threshold is our own guess, no literature anchor. |
| 13 Nov | In `relative` mode: calendar and anomalies from MODIS 2000-2025 alone, VIIRS shown next to it, `harm` is null | One consistent sensor; constant factors do not change relative metrics (INPE approach) |
| 13 Nov | Region units: administrative. Fit on NUTS2 (Greece, 13) and provinces (Argentina, 24); display also one level down (NUTS3, departments), inheriting the parent factor | NUTS3 averages about 35 MODIS detections a year, too thin for region × month × day/night strata. Argentine departments only if the web size allows. User-drawn area is nice-to-have over a 0.1° grid. |
| 13 Nov | Stratum fallback: ≥5 MODIS detections per year and ≥30 over the fit window; region × month × day/night, then × season × day/night, then × day/night, then national × day/night; Argentina night never pooled with Greece | Giglio 2006 mask; SAMA filter |
| 13 Nov | Calendar metrics computed in Python and stored in JSON; JS only recomputes anomalies for a user-chosen range | Validation and the app must use the same code |
| 13 Nov | Season year per region starts at its climatological minimum month; `bimodal` flag for display only (two peaks ≥2 months apart, trough <50 % of the smaller peak) | Central Macedonia has Jan-Mar and Oct-Nov seasons; two-season metrics would double the contract and validation |
| 13 Nov | Anomalies: percentile rank among the same month of the preceding 10 years (2002-2011 minus the target year for years before 2010); anomaly = above the 90th percentile or above the baseline max | GWIS pattern; works with zeros, no log1p z-score citation |
| 13 Nov | Outages from a manual list `data/outages.csv`; a month is flagged with ≥3 affected days | Zero-detection days are normal in Greek winter, so data cannot reveal outages |
| 13 Nov | Series ends Dec 2025; 2026 and the NOAA-20 splice are nice-to-have | S-NPP ended 2 Nov 2026; NOAA-20 needs a MAP_KEY |
| 13 Nov | JSON contract as in [data-contract.md](data-contract.md) | |
| 13 Nov | Agent access is must-have after the core: work starts once the Greece web build is deployed (Sat evening at the earliest); one slide and about 20 s live demo in the pitch | The jury scores Creativity and Impact; without harmonized data the agent has nothing to show ([agent-access.md](agent-access.md)) |
| 13 Nov | "No backend" amended: the web reads only static files; one stateless read-only function `api/mcp.ts` for agents; no DB, no FastAPI | The original reason (time, nothing needs a backend) still holds for the web; the function adds no state or secrets |
| 13 Nov | Static agent layer is must-have even without MCP: `/data/v1/` with CORS, JSON Schema, `/llms.txt`, URL-state deep links, per-region CSV | About 2 h; deep links and CSV also serve human users and the demo |
| 13 Nov | MCP server in TypeScript with `mcp-handler` 2.4.0 in the same Vercel project, data bundled via `includeFiles` | One deploy and URL, data versioned with the web; Python precomputes, TS only reads and filters |
| 13 Nov | Smoke test of `mcp-handler` without Next.js is the first task on Sat after 09:00, not earlier; fallback Hono | Space Apps forbids work on the project before 14 Nov 09:00 ([space-apps-rules.md](space-apps-rules.md)) |
| 13 Nov | Owners: Petr builds MCP, JSON Schema and the static agent layer; Vita builds URL-state deep links in the web | MCP sits on the contract Petr's pipeline writes; deep links are UI |
| 13 Nov | Countries: Greece and Argentina, both must-have. Development starts on Greece; Argentina is equal in the pitch, demo opens on Paraná 2020. Argentina minimum: provinces and one validation year; departments only if time allows | Greek data and numbers exist; CONAE wrote the challenge; two continents show the method is not tuned to one country |
| 13 Nov | Start from scratch on Sat 14 Nov after 09:00: new repo, FIRMS data downloaded again, all scripts and numbers recomputed; this repo stays a private archive | Space Apps FAQ forbids work on the project before the event ([space-apps-rules.md](space-apps-rules.md), Eligibility) |

## Open

- **Agent access, round 2.** Tool surface, `caveats` codes, response size caps, MCP Apps calendar widget (in or out), demo script. Draft in [agent-access.md](agent-access.md).
- **2026 and NOAA-20 splice.** Deferred (see Made, 13 Nov). Needs a FIRMS MAP_KEY.
- **Fire type split** (cropland vs forest via CORINE): nice-to-have.
