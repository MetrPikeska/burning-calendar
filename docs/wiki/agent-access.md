---
title: Agent access (MCP, llms.txt, deep links)
updated: 2026-11-14
verified_by: smoke test on https://burning-calendar.vercel.app/api/mcp (14 Nov 2026); npm registry mcp-handler 2.4.0 (published 12 Nov 2026, `next` optional peer); modelcontextprotocol.io/specification/versioning.md (current 2026-07-28); ext-apps client-matrix.mdx on GitHub (13 Nov 2026)
sources: [sources/2026-11-13-research-agent-access.md, https://modelcontextprotocol.io/specification/2026-07-28/changelog.md, https://github.com/vercel-labs/mcp-handler, https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/extensions/client-matrix.mdx]
---

How AI agents can use the burning calendar. Architecture, priority, language and owners decided 13 Nov ([decisions.md](decisions.md), Made). Tool surface and widget are still a proposal (Open).

## Proposed architecture

- One Vercel Function `api/mcp.ts` in the same project as the static site: `mcp-handler` 2.4.0 (pin exact, published 12 Nov 2026), `@modelcontextprotocol/server` ^2 (2.4.0), `zod` ^4, Node 20+.
- The function reads the same static JSON, bundled with `functions."api/mcp.ts".includeFiles: "public/data/**"` in `vercel.json`. Stateless, read-only, no auth, no secrets. The map works without it.
- Smoke test passed 14 Nov 2026: `web/api/mcp.ts` exports the handler as `GET` and `POST` in a plain Vercel function (framework `vite`, no Next.js); `initialize` and `tools/call` answer 200 over SSE on the production URL, and the tool reads `public/data/v1/**` bundled by `includeFiles`. Pinned: `mcp-handler` 2.4.0, `@modelcontextprotocol/server` 2.4.0, `zod` 4.6.7. A 2026-07-28 request without the per-request `_meta` envelope gets HTTP 400 (the SDK requires it); 2025-era clients work. Hono fallback not needed. Vercel puts `includeFiles` at their repo-relative path (`/var/task/web/public/...` for a Git deploy with root `web/`, `/var/task/public/...` for a CLI deploy from `web/`), so `api/mcp.ts` checks both.
- Effort: 4 to 6 h for 6 tools plus a MCP Inspector test (our estimate). Hobby plan: 1,000,000 invocations and 4 h Active CPU a month included.
- Any computation beyond reading JSON (custom-range anomalies) has to be TypeScript. Share one TS module between the web and the function.

## MCP protocol facts

- Current revision 2026-07-28: stateless, no `initialize` handshake, no `Mcp-Session-Id`, servers MUST implement `server/discover`. Previous 2025-11-25.
- Older clients still send `initialize`. `mcp-handler` 2.x serves both eras on one endpoint.
- Transports: stdio and Streamable HTTP. HTTP+SSE is deprecated. Streamable HTTP servers MUST validate `Origin` (not checked whether `mcp-handler` does it).
- Auth is OPTIONAL in the spec. A public read-only server complies.
- Tool annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`. ChatGPT asks for confirmation on tools without `readOnlyHint`.
- `structuredContent` must match `outputSchema`; the spec says a TextContent block with the serialized JSON SHOULD accompany it.
- Python alternative: FastMCP 4.1.8 over stdio. claude.ai cannot use stdio servers, so it does not fit a jury demo.

## Clients

| Client | How | Notes |
|---|---|---|
| claude.ai, Claude Desktop | Customize > Connectors > Add custom connector, paste URL | Any plan, Free allows one custom connector. Claude connects from Anthropic's cloud, so the URL must be public. |
| Claude Code | `claude mcp add --transport http burncal https://<app>/api/mcp` | |
| ChatGPT | chatgpt.com/plugins > Add custom MCP server, Work chat | Plan availability UNVERIFIED-SNIPPET (Business/Enterprise full, Plus/Pro read-only, Free none) |
| Cursor, VS Code Copilot | `mcp.json` / `.mcp.json` or settings UI | |

Jury path in 1 minute: claude.ai connector with no auth. Keep a recorded fallback, because a judge's Free account may already use its one connector.

## MCP Apps (UI in chat)

- Extension `io.modelcontextprotocol/ui`, spec stable 2026-01-26 (SEP-1865), SDK `@modelcontextprotocol/ext-apps` 2.0.4.
- Supported by Claude web, Claude Desktop, VS Code Copilot, ChatGPT, Cursor, Goose. Claude Code is not listed in the community matrix (Mapbox README says it renders; conflict).
- Declared as a `ui://` resource with `mimeType: "text/html;profile=mcp-app"`, linked from the tool by `_meta.ui.resourceUri`. External hosts go into `_meta.ui.csp`.
- Mapbox and OpenAI both separate data tools from one render tool. Mapbox says some hosts render only the last tool's panel (UNVERIFIED vendor claim).
- Feasible for us: a calendar heat strip (months x years, no basemap, no tile CSP). A full map widget is nice-to-have.

## Agent-ready web without MCP

- `/llms.txt` per llmstxt.org: H1, blockquote summary, H2 link lists, optional "Optional" section.
- JSON Schema 2020-12 for `index.json` and `regions/{id}.json`. MCP schemas default to 2020-12, so one schema serves docs and `outputSchema`.
- Versioned data path `/data/v1/...` with `Access-Control-Allow-Origin: *` via `headers` in `vercel.json`.
- URL-state deep links, for example `?region=EL52&from=2007-01&to=2007-12&mode=harmonized`. Every MCP result returns one as `view_url`.
- Precomputed `regions/{id}.csv` next to the JSON. JS export stays for user-picked ranges.
- OpenAPI 3.2.1 for the static paths is optional.
- WebMCP: W3C CG draft (12 Nov 2026), Chrome 149 origin trial. `mcp-handler` has an experimental bridge. Nice-to-have.

## Implemented tools (14 Nov 2026)

`web/api/mcp.ts` registers 10 read-only tools; the logic is in `web/api/_lib/tools.ts` (pure, tested in `web/test/mcp-tools.test.ts`).

| Tool | Inputs | Notes |
|---|---|---|
| `search_regions` | `country?`, `level?`, `query?`, `limit` | climatology, `area_km2`, `annual_mean` and `density_per_1000km2` (null for relative regions, raw values in `*_modis`), `loyo_mdape_pct`, `view_url` |
| `get_region_series` | `region_id`, `from`, `to`, `aggregate`, `fields?` (incl. `days_viirs`, `days_modis`) | max 120 monthly records, else an error that suggests `aggregate: "year"`; nulls omitted; month mode adds calendar-year `totals` on harm (modis in relative mode) with `partial`; ranges outside coverage are clipped with an `out_of_coverage` caveat; `view_url`, `data_url`, `csv_url`, `detections_csv_url` (Greece: individual hotspots; Argentina null plus `detections_note` pointing to FIRMS) |
| `get_season_calendar` | `region_id`, `year?` | climatology and season years; with `year` also `season_window`. In harmonized mode each season year has `backcast_months`, and years with back-cast months add `total_lo`, `total_hi`; `backcast` / `backcast_terra` caveats always, because the climatology uses the whole series from 2000-11 |
| `get_anomalies` | `region_id`, `year` | percentile, `baseline_median`, `baseline_p90`, `baseline_years`, `ratio_to_median`, `flagged` |
| `compare_regions` | `region_ids` (2-10), `metric`, `year?` | count metrics ranked only when all regions are harmonized (`ranking_allowed`); relative regions get `value_modis` instead of `value`; `season_total` rows add `backcast_months` and, with back-cast months, `value_lo`, `value_hi` plus a `backcast` caveat; a region without a complete season year gets `incomplete_season` (reason) instead of `value`, an `out_of_coverage` caveat names it and `ranking_allowed` is false |
| `aggregate` | `region_ids` (1-40), `from`, `to`, `top` | totals per region and overall, top months of the sum; harm when all regions are harmonized, else MODIS for all with a caveat; refuses a country together with its own regions; on harm each region has `backcast_months`, and periods with back-cast months add `total_lo`, `total_hi` per region and overall with `backcast` and, for Nov 2000 to Jun 2002, `backcast_terra` caveats |
| `rank_regions` | `metric`, `country?`, `level?`, `year?`, `top`, `order` | metrics `annual_mean`, `density_per_1000km2`, `season_total`, `season_length`, `loyo_mdape_pct`; count metrics rank harmonized regions only, relative ones in `excluded_relative`; country rows only with `level: country`; caveat `size_bias` for absolute counts; `season_total` rows add `backcast_months`, `value_lo`, `value_hi` (back-cast years, `backcast` caveat), and regions without a complete season year go to `incomplete_season` (id, `season_window`, reason) with an `out_of_coverage` caveat instead of being dropped |
| `find_region_at` | `lat`, `lon` | point in polygon (`regionAt` from `web/src/lib/geo.ts`) over `regions_mcp.geojson` (the 1:1M / IGN 0.001° assignment polygons, not the 1:20M map file); returns climatology, annual mean, last 3 season years, `view_url`, `data_url`, `detections_csv_url`, `backcast` caveat for climatology and annual mean; outside every polygon the nearest region within 5 km. Agreement with the region that counts a Greek hotspot: 99.98 % of 120,332 points (was 98.97 % on the 1:20M map polygons) |
| `get_validation` | `region_id` | LOYO and time-split errors per year with min/median/max, monthly scores, peak-month hit rates vs raw MODIS, fit-window gap, ratio trend, band, mode reasons; for `GR`/`AR` a table of all regions plus filter and assignment counts |
| `get_methodology` | `topic` | static text: overview, harmonization, validation, modes, anomalies, calendar, limits |

- The country comes from the region id (`GR`, `EL..` vs `AR`, two digits), so no tool needs a country argument besides `search_regions`.
- Every result has `source` (method version, FIRMS download dates, links to the full `source` block in the `index.json` of each country the result covers: one for a Greek or Argentine region, both for cross-country lists and `get_methodology`) and `coverage` (`start`, `end` from `index.json` `period`) and `caveats` with codes `coverage` (S-NPP end, no NOAA-20 splice), `out_of_coverage`, `relative_mode`, `backcast`, `backcast_terra`, `outage`, `detections_not_fires`. Series and anomaly results carry `anomaly_definition` (above `baseline_p90`). The text block lists them first, then the JSON; `structuredContent` carries the same object (no `outputSchema`).
- `season_total` rows (in `rank_regions` and `compare_regions`) carry `season_window` (`from`, `to`): each region's own season year, so windows differ between regions; a `season_window` caveat says so and points to `aggregate` for a common window.
- Ranges for sums (`total_lo`/`total_hi`, `value_lo`/`value_hi`) add `harm_lo` / `harm_hi` of the back-cast months to the observed values. Summing 10th / 90th percentile bounds overstates the range; the `backcast` caveat says so (bead burncal-kxs). Incomplete season years: bead burncal-774. Geometry: bead burncal-x9p.
- In full mode the caveat texts appear once, as header lines of the text block; the JSON there lists only `caveat_codes`, while `structuredContent` keeps the full caveats.
- Every tool except `get_methodology` takes `caveats: "full" | "codes"`. `codes` replaces the caveat texts with `caveat_codes`; `get_methodology` topic `caveats` explains them.
- `outage` (caveat and month field, with `outage_affects: "modis"`) only for months whose value comes from MODIS, because `data/outages.csv` lists Aqua gaps only. Changes from Petr's first claude.ai test (beads burncal-w7p, -nmk, -j03, -17x, -zgm).
- MCP resources and an MCP Apps widget are not built.
- Smoke test: `cd web && npm run smoke:mcp` (production) or `node scripts/smoke-mcp.mjs <base-url> [--no-static]` calls all 10 tools over Streamable HTTP, checks known values (Evia Aug 2021 flagged in EL64, EL30 2007-06 back-cast band, EL62 blocks ranking, point 38.8 N 23.4 E in EL64) plus `llms.txt` and the CORS header on `/data/v1`, and exits 1 on any failure. Run it after every push to `main`.

## Web entry and demo (14 Nov 2026)

- "Use with AI" button in the web header (`web/src/ui/agent-panel.ts`, native `<dialog>`, Esc and backdrop close it): MCP URL with copy button, claude.ai and Claude Code steps, one line each for ChatGPT, Cursor and VS Code, links to `/llms.txt` and both JSON Schemas, three example prompts with a deep link each (EL64 2021, Argentine density ranking, Entre Ríos 2020). Bead burncal-a2o.
- Pitch script for the 20 s live agent segment, slide, pre-flight and fallback recording: `docs/notes/2026-11-14-agent-demo.md`. Live prompt answers from one `get_anomalies` call: EL64 Aug 2021 = 4,235 detections, median 63.1 (2011-2020), 67.1×.

## Proposed tools (13 Nov design)

All read-only (`readOnlyHint: true`, `openWorldHint: false`), enums for `country` (`GR`, `AR`), `YYYY-MM` patterns, `structuredContent` plus a short text summary with caveats first.

| Tool | Inputs | Returns |
|---|---|---|
| `search_regions` | `country?`, `level?`, `query?`, `limit` | regions with `mode`, `peak_month`, `season_length`, `view_url` |
| `find_region_at` | `lat`, `lon`, `level?` | region or `{found: false}`; needs the topojson in the function |
| `get_region_series` | `region_id`, `from`, `to`, `aggregate` (`month`, `year`), `fields?` | records, `unit`, `caveats`, `view_url`, `data_url`, `csv_url`; cap 120 monthly records |
| `get_season_calendar` | `region_id`, `year?` | climatology and per-year metrics |
| `get_anomalies` | `region_id`, `year` | percentile ranks, flagged months, baseline years |
| `compare_regions` | `region_ids` (2 to 10), `metric`, `year?` | rows with `mode`; refuses absolute ranking when a region is `relative` |
| `get_methodology` | `topic?` | Markdown; mirrors resource `burncal://methodology/{topic}` |

- `caveats` array in every result, with codes `backcast`, `backcast_terra`, `outage`, `relative_mode`. Tool descriptions tell the model to report `harm_lo..harm_hi` for back-cast months.
- No tool returns geometry. The map lives behind `view_url`.
- Size: a full region is about 45 KB, roughly 12k tokens (estimate until the pipeline writes real files).

## Security

- Spec: servers MUST validate inputs, rate limit tool calls and sanitize outputs.
- Vercel WAF rate limit: Hobby gets 1 rule per project. claude.ai calls come from Anthropic IP ranges, so a per-IP limit must be generous.
- Region names come from NUTS and IGN through our pipeline: strip control characters and cap length.
- The function never fetches a URL from tool input, so SSRF does not apply.
- Space Apps 2026 FAQ: AI is called "Super Intelligence (SI)"; the submission must describe how SI tools were used ([space-apps-rules.md](space-apps-rules.md)).
