# TODO

Owners: P = Petr (data, method, pipeline, MCP), V = Vita (web, map, deep links, presentation).
Feature freeze Sun 15 Nov 12:00. Local submission Sun 15:00, pitch 16:00 (7 min + Q&A), portal closes 23:59.

## Must-have

- [x] P Scaffold: pyproject (uv), TODO.md, docs/si-use.md
- [x] P FIRMS download script, Greece CSVs in data/raw/firms/
- [x] P Argentina CSVs (40/40, 362 MB total in data/raw/firms/)
- [x] P+V Build plan agreed: docs/notes/2026-11-14-plan.md
- [x] P Fixture JSON for Vita: replaced by real v0 output in web/public/data/v1/gr/ (index.json, regions/GR.json)
- [x] P Check MODIS `version` values per year: 6.2 2000-17, 6.03 2018-22, 61.03 2023-25, no ratio step (data-firms.md)
- [ ] P Ask Local Lead / Discord: where to send the project at 15:00 (FAQ has "[email]" placeholder), demo setup (HDMI/USB-C, own laptop, Wi-Fi)
- [x] P Greece vertical slice, whole country as region `GR` (`uv run python pipeline/build.py --country GR`, tests in tests/)
- [ ] V Year x month heatmap reading the JSON, deployed on Vercel at a public URL (milestone Sat 13:00)
- [ ] P Full harmonization: region x month x d/n factors, fallback chain, Terra-only chaining, LOYO validation, `relative` mode
- [ ] V Toggle MODIS / VIIRS / harmonized, region picker on the map
- [ ] P Region geometry: GISCO NUTS 2024 1:20M (GR), IGN provinces (AR), TopoJSON
- [ ] P Argentina through the same pipeline (provinces + Paraná 2020 minimum)
- [ ] P Anomalies (percentile vs preceding 10 years), outages from data/outages.csv
- [ ] V CSV export per region (JS from monthly records)
- [ ] P Static agent layer: /data/v1/ with CORS, JSON Schema, /llms.txt, deep links
- [ ] P api/mcp.ts (mcp-handler 2.4.0 exact): smoke test, then tools with `caveats` and `view_url`
- [ ] P+V README (problem, method, LOYO number, limits, how to run), MIT licence
- [ ] V Slides (PDF, English, max 7 for global demo), 30 s video, backup screen recording
- [ ] P+V Project page on the NASA portal, first save by Sun 14:00

## Nice-to-have

- [ ] NOAA-20 splice after S-NPP
- [ ] 2026 data (NRT)
- [ ] Departments / NUTS3 display level
- [ ] FRP layer
- [ ] CORINE split of the factor

## Cut

- FastAPI, PostGIS, any live backend processing
- WebMCP
- Hex grid
