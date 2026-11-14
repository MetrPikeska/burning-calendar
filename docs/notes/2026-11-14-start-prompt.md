# Context: NASA Space Apps 2026, Thessaloniki, "Harmonization of MODIS and VIIRS Hot Spots"

## Situation
- Hackathon Sat 14 Nov 09:00 to Sun 15 Nov 2026. Local submission Sun 15:00, pitch 16:00. Global window closes Sun 23:59.
- Team Spearow: Petr (data, method, pipeline, MCP), Vita (web UI, map, deep links, presentation).
- This is a NEW repo started today. Everything here is written during the event. Do not copy code, data or computed numbers from `~/hackathon`.
- Background research from before the event is in `~/hackathon/docs/wiki/` (index: `index.md`). Read it as reference for facts, methods and URLs. Treat the numbers in `findings-greece.md` as unknown until our new code recomputes them.

## Challenge (CONAE, Argentina)
Build a web app that harmonizes MODIS and VIIRS active fire records into a burning activity calendar. Early warning teams, emergency responders, scientists and land managers must be able to study historical fire patterns, unusual conditions and critical periods for a selected area. Part 1 is harmonization, so the sensor behind a hotspot stops mattering. Part 2 is the app: the user picks a region and dates, sees its fire history and downloads analytics (CSV).

## Decisions already made (do not reopen)
- Data: FIRMS country CSVs, standard processing, MODIS (Terra+Aqua) 2000-2025 and VIIRS S-NPP 2012-2025, Greece and Argentina. No key needed. Series ends Dec 2025; NOAA-20 and 2026 are nice-to-have.
- Filters: `type == 0`; static-source filter (0.01° cell seen on ≥16 distinct days in a year); no MODIS scan filter.
- Reference scale: VIIRS-equivalent. VIIRS kept as-is from 2012; 2000-2011 back-cast from MODIS by region × month × day/night factors. Fit on 2012-2019 and 2012-2025; if they differ by more than the LOYO error, use 2012-2019 (MODIS orbit drift).
- Terra-only months (Nov 2000 to Jun 2002): chained factor (T+A)/T fitted on 2003-2011, then V/(T+A). Flag them `backcast_terra`.
- Stratum fallback: ≥5 MODIS detections per year and ≥30 over the fit window. Order: region × month × day/night, then season × d/n, then region × d/n, then national × d/n. Never pool Argentine nights with Greek ones.
- Per-region `relative` mode when LOYO median absolute error of annual totals is above 25 %, or the back-cast peak-month hit rate is worse than raw MODIS vs VIIRS. In that mode, calendar and anomalies come from MODIS alone and `harm` is null.
- Regions: fit on NUTS2 (Greece, 13) and provinces (Argentina, 24). Also display one level down (NUTS3, departments), inheriting the parent factor. Geometry: GISCO NUTS 2024 1:20M and simplified IGN, one TopoJSON per country.
- Calendar metrics are computed in Python and stored in JSON. Season year starts at the climatological minimum month. The `bimodal` flag is for display only.
- Anomalies: percentile rank against the same month in the preceding 10 years; flag above P90 or above the baseline max. Outages come from a manual `data/outages.csv`, with ≥3 affected days to flag a month.
- Web: static MapLibre GL JS on Vercel, reads only static files. No FastAPI, no PostGIS.
- Data contract: `index.json` per country (schema_version, generated_at, regions with summary metrics and mode) plus `regions/{id}.json` (monthly records `ym, modis, viirs, harm, harm_lo, harm_hi, src, fit_level, outage, outage_days` and per-year metrics) plus `{country}.topojson`. Full spec: `~/hackathon/docs/wiki/data-contract.md`.
- Agent access is a must-have after the core:
  - Static layer: `/data/v1/` with CORS, JSON Schema, `/llms.txt`, URL-state deep links, per-region CSV.
  - One read-only stateless function `api/mcp.ts`, TypeScript, `mcp-handler` 2.4.0 (pin exact), data bundled with `includeFiles`.
  - Every tool result carries `caveats` and `view_url`.
  - Design: `~/hackathon/docs/wiki/agent-access.md`.
  - Fallback if `mcp-handler` fails outside Next.js: a Hono route.

## Order of work today
1. 09:00 Set up the repo: README stub, TODO.md (must-have / nice-to-have / cut), pyproject with uv, `.gitignore` for `data/raw/`. Then download the FIRMS CSVs for Greece and Argentina.
2. 09:30 Smoke test: an empty Vercel project with `api/mcp.ts` and one dummy tool, connected in claude.ai as a custom connector. Decide on mcp-handler or Hono by 10:00.
3. 10:00 Kick-off. Questions for the Local Lead: deadline 15:00 or 23:59, pitch length, live demo setup.
4. By 13:00, one vertical slice for Greece: CSV, factor, JSON, year × month heatmap, deployed on Vercel.
5. Then:
   - full harmonization with LOYO validation,
   - Argentina (provinces + Paraná 2020),
   - anomalies, outages, CSV export,
   - static agent layer, MCP tools,
   - README and demo.

## How to work with me
- Answer in Czech. Code, identifiers and commits in English.
- Conclusion first, one recommendation instead of a list of options.
- Simplest end-to-end thing first. Precompute everything; the demo must not depend on live heavy processing.
- Do not invent FIRMS columns, endpoints or package APIs; check docs. Before running over a full dataset, check the logic on a few samples.
- Do not commit or push unless I ask.
- Keep TODO.md current.
- Keep a short `docs/si-use.md` log of how SI (AI) tools were used, because the submission requires it.
