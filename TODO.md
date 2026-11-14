# TODO

Owners: P = Petr (data, method, pipeline, MCP), V = Vita (web, map, deep links, presentation).
Everything is built on Petr's laptop and deployed from Petr's GitHub and Vercel (no separate Vita project).
Feature freeze Sun 15 Nov 12:00. Local submission Sun 15:00, pitch 16:00 (7 min + Q&A), portal closes 23:59.

## Must-have

- [x] P+V Team decision on the peak-hit rule: relative only when more than one season year worse than raw MODIS (decisions.md)

- [x] P Scaffold: pyproject (uv), TODO.md, docs/si-use.md
- [x] P FIRMS download script, Greece CSVs in data/raw/firms/
- [x] P Argentina CSVs (40/40, 362 MB total in data/raw/firms/)
- [x] P+V Build plan agreed: docs/notes/2026-11-14-plan.md
- [x] P Fixture JSON for Vita: replaced by real v0 output in web/public/data/v1/gr/ (index.json, regions/GR.json)
- [x] P Check MODIS `version` values per year: 6.2 2000-17, 6.03 2018-22, 61.03 2023-25, no ratio step (data-firms.md)
- [ ] P Ask Local Lead / Discord: where to send the project at 15:00 (FAQ has "[email]" placeholder), demo setup (HDMI/USB-C, own laptop, Wi-Fi)
- [x] P Greece vertical slice, whole country as region `GR` (`uv run python pipeline/build.py --country GR`, tests in tests/)
- [x] P Web scaffold in web/ (Vite + TS, MapLibre with OpenFreeMap / local fallback, Observable Plot heatmap, URL state, vercel.json with CORS); `cd web && npm run dev`
- [x] P Deploy web/ on Petr's Vercel: https://burning-calendar.vercel.app (CLI from web/, `vercel deploy --prod --yes`, no Git auto-deploy; CLI only under Node 20)
- [x] P Full harmonization GR: region x month x d/n factors, fallback chain, Terra-only chaining, LOYO, time split, `relative` mode (findings-greece.md)
- [x] P Toggle MODIS / VIIRS / harmonized, region picker on the map (basic version in the scaffold)
- [x] P `baseline_median`, `baseline_p90`, `baseline_years` per month in regions/{id}.json and CSV
- [x] P Panel "chosen month vs median of the preceding 10 years" (web/src/charts/median.ts): default = strongest month in the range, else Dec 2025; click a heatmap cell to pick
- [x] P Lat/lon input mapped to a region (web/src/lib/geo.ts, marker on the map) + region dropdown incl. GR/AR
- [x] P Date range from/to (dims cells outside, kept in the URL)
- [x] P Region geometry: GISCO NUTS 2024 1:20M (GR), IGN provinces (AR), as regions.geojson
- [x] P Argentina through the same pipeline (24 provinces, Paraná 2020 in findings-argentina.md)
- [x] P Anomalies (percentile vs preceding 10 years), outages from data/outages.csv (in the JSON; outage list has only Aqua 2020 so far)
- [x] P CSV download: static regions/{id}.csv, range-filtered in JS when from/to are set (web/src/lib/csv.ts)
- [x] P Static agent layer files: per-region CSV, JSON Schema (data/v1/schema/, tested), /llms.txt
- [x] P CORS header for /data/v1/* in web/vercel.json
- [x] P Deep-link format into llms.txt: `?country=gr&region=EL52&from=YYYY-MM&to=YYYY-MM&series=harm|modis|viirs` (web/src/lib/url-state.ts)
- [x] P api/mcp.ts smoke test on Vercel (mcp-handler 2.4.0, one tool `search_regions`), https://burning-calendar.vercel.app/api/mcp
- [x] P MCP tools with `caveats` and `view_url`: 7 tools in web/api/mcp.ts, logic in web/api/_lib/tools.ts, vitest
- [ ] P Test the deployed MCP with MCP Inspector and a claude.ai custom connector; record a fallback video
- [x] P Vercel Git auto-deploy connected (root `web/`, branch main)
- [x] P Push deploy of fc59713 went to production automatically, /api/mcp checked
- [x] P+V README (problem, method, LOYO number, limits, how to run), MIT licence, DATA_LICENSE.md, CITATION.cff
- [ ] V Slides (PDF, English, max 7 for global demo), 30 s video, backup screen recording
- [ ] P+V Project page on the NASA portal, first save by Sun 14:00

## Nice-to-have

- [ ] NOAA-20 splice after S-NPP
- [x] 2026 data (NRT): Jan-Oct 2026 from the FIRMS area API, NRT months provisional
- [ ] Departments / NUTS3 display level
- [ ] FRP layer
- [ ] CORINE split of the factor

## Cut

- FastAPI, PostGIS, any live backend processing
- WebMCP
- Hex grid
