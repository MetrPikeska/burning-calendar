---
title: Decisions
updated: 2026-11-14
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
| 13 Nov | Fallback per region: mode `relative` when LOYO median absolute error of annual totals is above 25 %, or back-cast peak-month hit rate is worse than raw MODIS vs VIIRS | Fixed before seeing results. The 25 % threshold is our own guess, no literature anchor. Peak-hit part amended 14 Nov (below). |
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
| 14 Nov | Vertical slice first: whole country as one region `GR`, then NUTS2 | A heatmap with real data on Vercel by 13:00 |
| 14 Nov | Web stack Vite + TypeScript, no framework, MapLibre; data in `web/public/data/v1/{gr,ar}/`; generated JSON committed | Vercel runs no Python; demo works offline |
| 14 Nov | Map geometry as GeoJSON (`regions.geojson`), not TopoJSON | MapLibre reads GeoJSON directly; Greece NUTS2 1:20M is 15 kB |
| 14 Nov | Detections assigned with GISCO 1:1M; outside any polygon, nearest region within 5 km, else national only | 1,510 coastal detections fall just outside the 1:1M coastline |
| 14 Nov | Season year starts at the climatological minimum of the region's MODIS series | Scale-free, independent of the fit, same in both modes and in validation |
| 14 Nov | Season-year label = calendar year holding most of its months (start month 8-12 gives the next year) | With a December start, the Paraná Delta 2020 fires were labelled 2019 |
| 14 Nov | Argentina provinces from the IGN WFS layer `ign:provincia` (SHAPE-ZIP), id `in1`, clipped at 56° S; web geometry simplified at 0.02° (141 kB) | Same ids as CONAE; direct file links do not exist on the IGN page |
| 14 Nov | Country itself is a region (`GR`) fitted on national counts, shown next to NUTS2 | National LOYO error 5.4 %, a clear number for the pitch |
| 14 Nov | Mode rule amended after seeing results: the peak-hit part triggers `relative` only when the harmonized series misses the VIIRS peak month in more than one season year more than raw MODIS (error threshold 25 % unchanged) | With 7-8 held-out season years one year moves the hit rate by 0.13-0.14; the original rule put EL51, EL61, EL64, Corrientes and Salta in `relative` on a single year while their annual errors were 4-17 %. Changed after results; say so in the pitch and README |
| 14 Nov | Primary persona: early warning analyst (CONAE team, regional civil protection). Secondary: land manager / agricultural regulator, scientist. Firefighter and journalist are not personas ([personas.md](personas.md)) | The challenge page names emergency managers twice for the calendar; the author's own team; the demo opens on Paraná |
| 14 Nov | No 2026 data in the core: the demo job is "pick any month and compare it with the median of the preceding 10 years"; 2026 via NOAA-20 stays a stretch goal after Argentina and MCP | The NOAA-20 splice needs its own fit and validation; series ends Dec 2025 |
| 14 Nov | Charts with Observable Plot; basemap OpenFreeMap positron (no key) with a local Natural Earth fallback when offline or with `?basemap=local` | Plot gives cell, area and line marks with tooltips in a few lines; the demo must survive without Wi-Fi |
| 14 Nov | Vercel project root `web/`; future function at `web/api/mcp.ts`; DOM-free TS shared by web and function in `web/src/lib/` | One deploy; `includeFiles: public/data/**` resolves relative to the root |
| 14 Nov | Hosting and build: everything (pipeline, web, MCP function) is built on Petr's laptop and deployed from Petr's own GitHub repo `MetrPikeska/burning-calendar` and Petr's Vercel account; no separate Vercel project for Vita |
| 14 Nov | Vercel project `burning-calendar` on Petr's account, root directory `web/`, Git auto-deploy from `MetrPikeska/burning-calendar` branch `main` (connected 14 Nov); CLI deploys only as a fallback, run from the repo root | Production URL https://burning-calendar.vercel.app; every push deploys, so production never carries uncommitted work | One repo, one deploy, one URL for the jury; replaces the plan's assumption that Vita sets up `web/` on Vercel |
| 14 Nov | UI polish: the map colours harmonized regions by `density_per_1000km2` with the same reversed inferno ramp as the calendar (map clipped to 6-90 % of the ramp, regions under basemap labels, legend added); IBM Plex Sans self-hosted from npm `@fontsource-variable/ibm-plex-sans`; country as a toggle; season strip, marks key; the median panel opens on the strongest of the last 12 months, not December 2025 | One colour language for one quantity (detections); the font ships in the bundle, so the offline demo keeps it; impeccable critique found the off-season default month and the black selection ring vanishing on the darkest cells |
| 14 Nov | Licences: code MIT; harmonized data in `web/public/data/v1/` CC BY 4.0, not CC0; region polygons keep their source terms (DATA_LICENSE.md, CITATION.cff) | Petr. GISCO boundaries require the attribution "© EuroGeographics for the administrative boundaries" and IGN requires its source line, so the data release carries an attribution licence too; CC BY 4.0 is also the Zenodo default for a later DOI |
| 14 Nov | Context layer for the chosen month: FWI (CEMS, ERA5-based), SPEI-3 and SPEI-6, land cover from CORINE, Greece only, optional JSON fields and a Context panel; no model, no lag analysis, no forecast claim | Feedback asks for weather and drought context; 25 years of data and one winter do not support a prediction. Data not yet downloaded (EWDS key needed). See `docs/notes/2026-11-14-faktory-a-model.md` |

## Open

- **Agent access, round 2.** Tool surface, `caveats` codes, response size caps, MCP Apps calendar widget (in or out), demo script. Draft in [agent-access.md](agent-access.md).
- **2026 and NOAA-20 splice.** Deferred (see Made, 13 Nov). Needs a FIRMS MAP_KEY.
- **Fire type split** (cropland vs forest via CORINE): nice-to-have.
- **Predictive model and lag analysis of weather and drought.** Design in `docs/notes/2026-11-14-faktory-a-model.md`. Not decided. Extrapolating the series is not planned. The context layer below is built without a model.
