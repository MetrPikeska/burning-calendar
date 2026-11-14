# Use of Super Intelligence (SI)

Log for the "Use of Super Intelligence" field on the project page and for acknowledgements in the README. Space Apps rules: SI must not be used to come up with the idea of how to solve the challenge; SI-generated code and data must be acknowledged.

The idea and the method (VIIRS-equivalent reference scale, back-cast factors by region x month x day/night, LOYO validation, static-source filter) were decided by the team; see docs/wiki/decisions.md.

| Date, time | Tool | What it did | Output |
|---|---|---|---|
| 11-13 Nov | Claude (Anthropic) | Literature and documentation research before the event (FIRMS, sensors, harmonization precedents, rules) | docs/wiki/sources/ |
| 14 Nov 10:30 | Claude Code (Claude Opus 5.5) | Read organiser emails and the Thessaloniki FAQ / Presentation Guide, summarised them into the wiki | docs/wiki/sources/2026-11-14-thessaloniki-organiser-info.md |
| 14 Nov 10:45 | Claude Code (Claude Opus 5.5) | Wrote the project scaffold and the FIRMS download script | pyproject.toml, pipeline/download_firms.py, TODO.md |
| 14 Nov 10:40 | Claude Code (Claude Opus 5.5) | Wrote the Greece vertical-slice pipeline (loader, static filter, v0 factors, calendar metrics, anomalies, JSON export) and unit tests, following the team's method in docs/wiki/decisions.md | pipeline/load.py, filters.py, harmonize.py, calendar_metrics.py, export.py, build.py, tests/ |
| 14 Nov 11:00 | Claude Code (Claude Opus 5.5) | Wrote the NUTS2 assignment, regional fit with fallback chain, LOYO / time-split / trend validation and the mode rule as decided by the team; summarised results into the wiki | pipeline/regions.py, harmonize.py, validate.py, build.py, tests/test_harmonize.py, docs/wiki/findings-greece.md |
| 14 Nov 11:10 | Claude Code (Claude Opus 5.5) | Found the IGN WFS download, ran the pipeline for Argentina, changed the season-year label, summarised results into the wiki | pipeline/regions.py, calendar_metrics.py, docs/wiki/findings-argentina.md |
| 14 Nov 13:30 | Claude Code (Claude Opus 5.5) | Wrote the static agent layer: per-region CSV export, JSON Schemas for index and region files with schema tests, /llms.txt | pipeline/export.py, web/public/data/v1/schema/, web/public/llms.txt, tests/test_export.py |
| 14 Nov 11:30 | Claude Code (Claude Opus 5.5) | Sparring partner for the persona choice (the team picked the primary persona); saved the full challenge page into the wiki | docs/wiki/personas.md, docs/wiki/challenge.md, docs/wiki/sources/2026-11-14-challenge-page.md |
| 14 Nov 11:45 | Claude Code (Claude Opus 5.5) | Wrote the web scaffold (map, heatmap, URL state, data types) on the stack the team chose, and the offline basemap script | web/, pipeline/basemap.py |
| 14 Nov 11:20 | Claude Code (Claude Opus 5.5) | Wrote the MCP smoke-test endpoint with one read-only tool, Vercel function config, deployed and tested it | web/api/mcp.ts, web/api/tsconfig.json, web/vercel.json |
| 14 Nov 11:45 | Claude Code (Claude Opus 5.5) | Added baseline median, p90 and window per month to the anomaly step, with a test, and rebuilt both countries | pipeline/calendar_metrics.py, build.py, export.py, tests/test_calendar_metrics.py |
| 14 Nov 15:00 | Claude Code (Claude Opus 5.5) | Wrote the web features the team ordered (region dropdown, lat/lon lookup, date range, CSV download, month-vs-median panel) and their tests | web/src/, web/test/lib.test.ts |
| 14 Nov 12:00 | Claude Code (Claude Opus 5.5) | Wrote the 7 MCP tools (search, series, season calendar, anomalies, compare, point lookup, methodology) with caveats and deep links, and their tests | web/api/mcp.ts, web/api/_lib/tools.ts, web/test/mcp-tools.test.ts |
| 14 Nov 12:05 | Claude Code (Claude Opus 5.5) | Reworked the MCP tool outputs after Petr's claude.ai test (coverage, outage scope, mode-safe counts, compact series, point lookup summary) with tests | web/api/_lib/tools.ts, web/api/mcp.ts, web/test/mcp-tools.test.ts |
