---
title: Agent access (MCP, llms.txt, deep links)
updated: 2026-11-15
verified_by: `cd web && npm test` (test/mcp-endpoint.test.ts) and `node scripts/smoke-mcp.mjs http://127.0.0.1:3210 --no-static` against a local node:http wrapper of api/mcp.ts (14 Nov 2026); smoke test on https://burning-calendar.vercel.app/api/mcp (14 Nov 2026); mcp-handler 2.4.0 and @modelcontextprotocol/server 2.4.0 source in web/node_modules; ext-apps 2.0.4 npm tarball (dist/src/spec.types.d.ts, server/index.js); npm registry mcp-handler 2.4.0 (published 12 Nov 2026, `next` optional peer); modelcontextprotocol.io/specification/versioning.md (current 2026-07-28); ext-apps client-matrix.mdx on GitHub (13 Nov 2026); live tools: `node scripts/live-harness.mjs` and the smoke script against a local in-process server (14 Nov 2026, not deployed)
sources: [sources/2026-11-13-research-agent-access.md, https://modelcontextprotocol.io/specification/2026-07-28/changelog.md, https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.md, https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx, https://github.com/vercel-labs/mcp-handler, https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/extensions/client-matrix.mdx, sources/2026-11-14-research-live-sources.md]
---

How AI agents can use the burning calendar. Architecture, priority, language and owners decided 13 Nov ([decisions.md](decisions.md), Made). The 16 tools (10 data, 1 widget, 5 live context including `investigate_month`) are built (Implemented tools, MCP Apps).

## Proposed architecture

- One Vercel Function `api/mcp.ts` in the same project as the static site: `mcp-handler` 2.4.0 (pin exact, published 12 Nov 2026), `@modelcontextprotocol/server` ^2 (2.4.0), `zod` ^4, Node 20+.
- The function reads the same static JSON, bundled with `functions."api/mcp.ts".includeFiles: "public/data/**"` in `vercel.json`. Stateless, read-only, no auth, no secrets. The map works without it.
- Smoke test passed 14 Nov 2026: `web/api/mcp.ts` exports the handler as `GET` and `POST` in a plain Vercel function (framework `vite`, no Next.js); `initialize` and `tools/call` answer 200 over SSE on the production URL, and the tool reads `public/data/v1/**` bundled by `includeFiles`. Pinned: `mcp-handler` 2.4.0, `@modelcontextprotocol/server` 2.4.0, `zod` 4.6.7. A 2026-07-28 request without the per-request `_meta` envelope gets HTTP 400 (the SDK requires it, and the spec does too, see MCP protocol facts); 2025-era clients work. Hono fallback not needed. Vercel puts `includeFiles` at their repo-relative path (`/var/task/web/public/...` for a Git deploy with root `web/`, `/var/task/public/...` for a CLI deploy from `web/`), so `api/mcp.ts` checks both.
- Effort: 4 to 6 h for 6 tools plus a MCP Inspector test (our estimate). Hobby plan: 1,000,000 invocations and 4 h Active CPU a month included.
- Any computation beyond reading JSON (custom-range anomalies) has to be TypeScript. Share one TS module between the web and the function.

## MCP protocol facts

- Current revision 2026-07-28: stateless, no `initialize` handshake, no `Mcp-Session-Id`, servers MUST implement `server/discover`. Previous 2025-11-25.
- A compliant 2026-07-28 request carries `params._meta` with `io.modelcontextprotocol/protocolVersion: "2026-07-28"` and `io.modelcontextprotocol/clientCapabilities` (and SHOULD carry `io.modelcontextprotocol/clientInfo`), plus the headers `MCP-Protocol-Version: 2026-07-28` and `Mcp-Method: <method>`; `tools/call` also needs `Mcp-Name: <tool name>` and `resources/read` `Mcp-Name: <uri>` (changelog items 2 and SEP-2243). `server/discover` is an ordinary request and carries the same envelope.
- Our endpoint, tested 14 Nov 2026 with the handler called directly: `server/discover` with the envelope returns 200 and `supportedVersions: ["2026-07-28"]`; `tools/list`, `tools/call` and `resources/read` with envelope and headers return 200. Rejections come from the SDK and match the spec: `MCP-Protocol-Version: 2026-07-28` without `_meta` gives HTTP 400 (-32602), a missing `Mcp-Name` gives HTTP 400 (-32020). A POST with neither header nor envelope is treated as 2025-era traffic, so a bare `server/discover` gets -32601 Method not found. 2025-era `initialize` (2025-06-18) and plain `tools/list` keep working.
- Older clients still send `initialize`. `mcp-handler` 2.x serves both eras on one endpoint.
- Transports: stdio and Streamable HTTP. HTTP+SSE is deprecated. Streamable HTTP servers MUST validate `Origin` and answer 403 when it is present and invalid. `mcp-handler` 2.4.0 does not check it, and the SDK entry it wraps leaves the check to the caller (it exports `originValidationResponse`). Production answered 200 to `Origin: https://evil.example` on 14 Nov 2026; `web/api/_lib/origin.ts` adds the check (Security).
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

- Built 14 Nov 2026 (burncal-e8b): render tool `show_calendar` plus resource `ui://burning-calendar/calendar-v1.html` (`text/html;profile=mcp-app`, `_meta.ui.prefersBorder: true`), code in `web/api/_lib/widget.ts` and `web/api/_lib/widget-html.ts`. The tool has `_meta.ui.resourceUri` and the deprecated flat `_meta["ui/resourceUri"]`, as `registerAppTool` in ext-apps 2.0.4 writes it. The resource is listed in `resources/list`.
- No new dependency: the view speaks the postMessage protocol by hand (`ui/initialize`, `ui/notifications/initialized`, `ui/notifications/tool-result`, `ui/notifications/host-context-changed`, `ui/notifications/size-changed`, `ui/open-link`), method names checked against ext-apps 2.0.4 `spec.types.d.ts`. The ext-apps browser bundle with deps is 532 KB.
- The HTML is self-contained (inline CSS and JS, no external hosts), so it needs no `_meta.ui.csp`; a test fails if it gains a script src, link, img, fetch or an absolute URL other than our own site. It draws a years x months heat strip: reversed inferno on a sqrt scale like the web calendar, harm in harmonized mode or MODIS in relative mode, back-cast months hatched, anomalies (above `baseline_p90`) outlined in #2a9df4, known MODIS outages as a cross, title with region name and mode, caveat codes, a link to `view_url`. Light and dark follow `hostContext.theme` and the host CSS variables, with `prefers-color-scheme` as fallback. Region names are set with `textContent`, never as HTML.
- Checked in headless Chrome with a fake host page (sandboxed iframe, `allow-scripts`) for EL64 2000-2025 light and dark, EL62 relative and Entre Ríos with `caveats: "codes"`. Not yet seen in a real host.
- The URI carries a version (`calendar-v1`): bump it when the HTML changes, because hosts MAY cache ui:// resources.
- Extension `io.modelcontextprotocol/ui`, spec stable 2026-01-26 (SEP-1865), SDK `@modelcontextprotocol/ext-apps` 2.0.4.
- Supported by Claude web, Claude Desktop, VS Code Copilot, ChatGPT, Cursor, Goose. Claude Code is not listed in the community matrix (Mapbox README says it renders; conflict).
- Declared as a `ui://` resource with `mimeType: "text/html;profile=mcp-app"`, linked from the tool by `_meta.ui.resourceUri`. External hosts go into `_meta.ui.csp`.
- Mapbox and OpenAI both separate data tools from one render tool. Mapbox says some hosts render only the last tool's panel (UNVERIFIED vendor claim).
- A full map widget is nice-to-have and not planned.

## Agent-ready web without MCP

- `/llms.txt` per llmstxt.org: H1, blockquote summary, H2 link lists, optional "Optional" section.
- JSON Schema 2020-12 for `index.json` and `regions/{id}.json`. MCP schemas default to 2020-12, so one schema serves docs and `outputSchema`.
- Versioned data path `/data/v1/...` with `Access-Control-Allow-Origin: *` via `headers` in `vercel.json`.
- URL-state deep links, for example `?region=EL52&from=2007-01&to=2007-12&mode=harmonized`. Every MCP result returns one as `view_url`.
- Precomputed `regions/{id}.csv` next to the JSON. JS export stays for user-picked ranges.
- OpenAPI 3.2.1 for the static paths is optional.
- WebMCP: W3C CG draft (12 Nov 2026), Chrome 149 origin trial. `mcp-handler` has an experimental bridge. Nice-to-have.

## Implemented tools (14 Nov 2026)

`web/api/mcp.ts` registers 16 read-only tools (10 data tools, the `show_calendar` widget, 5 live context tools from `web/api/_lib/live/register.ts`) and 1 resource; the data logic is in `web/api/_lib/tools.ts` (pure, tested in `web/test/mcp-tools.test.ts`), the widget in `web/api/_lib/widget.ts`. `web/test/mcp-endpoint.test.ts` calls the exported handler with web Requests in both protocol eras.

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
| `show_calendar` | `region_id`, `from?`, `to?` (default all of 2000-11 to 2025-12), `series?` (`harm`, `modis`, `viirs`; default harm, or modis for relative regions, which refuse harm) | MCP Apps render tool. `structuredContent` has one cell per month (`ym`, `v`, `lo`/`hi` for back-cast harm, `src`, `anom`, `outage`) plus calendar-year `totals`, `anomaly_months`, `max_value`, links and the usual `source`, `coverage`, `caveats`. The text block keeps the caveat lines first but drops the cells (`months_in_widget` instead), so text-only hosts get totals, anomaly months and `view_url` without about 18 KB of cells |

- The country comes from the region id (`GR`, `EL..` vs `AR`, two digits), so no tool needs a country argument besides `search_regions`.
- Every result has `source` (method version, FIRMS download dates, links to the full `source` block in the `index.json` of each country the result covers: one for a Greek or Argentine region, both for cross-country lists and `get_methodology`) and `coverage` (`start`, `end` from `index.json` `period`) and `caveats` with codes `coverage` (S-NPP end, no NOAA-20 splice), `out_of_coverage`, `relative_mode`, `backcast`, `backcast_terra`, `outage`, `detections_not_fires`. Series and anomaly results carry `anomaly_definition` (above `baseline_p90`). The text block lists them first, then the JSON; `structuredContent` carries the same object (no `outputSchema`).
- `season_total` rows (in `rank_regions` and `compare_regions`) carry `season_window` (`from`, `to`): each region's own season year, so windows differ between regions; a `season_window` caveat says so and points to `aggregate` for a common window.
- Ranges for sums (`total_lo`/`total_hi`, `value_lo`/`value_hi`) add `harm_lo` / `harm_hi` of the back-cast months to the observed values. Summing 10th / 90th percentile bounds overstates the range; the `backcast` caveat says so (bead burncal-kxs). Incomplete season years: bead burncal-774. Geometry: bead burncal-x9p.
- Since 15 Nov: `small_counts` caveat in `get_anomalies` and `get_region_series` when a flagged month has fewer than 20 detections (EL52 May 2024: 13 against median 8); `annual_mean` and `density_per_1000km2` in `compare_regions` and `rank_regions` carry a `backcast` caveat (the mean includes the modelled years before Feb 2012, burncal-k9p); the `coverage` caveat names the live tools for the current situation, because an agent (ChatGPT, 14 Nov) read the old text as "no current data at all".
- Since 15 Nov, after the second ChatGPT review: every answer with numbers carries `units` (field name to scale); relative regions (02, 94, EL62) report `unit` "raw MODIS ...", in the data files too, where they said VIIRS-equivalent before; `anom_pct` is described as a percentile rank, not a percent change. Months carry `baseline_kind` (`retrospective`, or `fixed_2002_2011` before 2012). `compare_regions` and `rank_regions` take `year_total` (January to December, one window for every region) next to `season_total`. `get_recent_detections` returns null instead of 0 for the NOAA-20 rate and the ratio when that source failed or the window has no full day (`ratio_unavailable`), and no ratio on a baseline month under 20 detections (`low_baseline`); `per_sensor_per_day` and `comparison` say that only NOAA-20 is set against S-NPP.
- `investigate_month` (`region_id`, `ym`, in `web/api/_lib/live/investigate.ts`): the calendar month (value, likely range, anomaly, percentile rank, baseline, ratio to the median, rank among the same month of all years, days with a detection, outages), the Open-Meteo ERA5 summary for the month at the region's point, and for the current or previous month FIRMS NRT (7 days) and GDACS / Copernicus EMS alerts (14 days), plus evidence links. History never depends on a third party; a failing live part adds `upstream_error`. Caveat `association_not_cause`. EL64 Aug 2021: 4,235, rank 1 of 26 Augusts, 41.7 C max and 7 % min humidity at the region point, 0 hot-dry-windy days (max wind 16 km/h there; the point is on the mainland, not on Evia, see `single_point`).
- `web/test/consistency.test.ts` checks across tools: aggregate = series year total = sum of months (GR, EL52, AR, 30; 2005 and 2020), national totals vs the sum of regions on observed months (GR NUTS2 0.25 % below GR, at most 6.6 % in a month over 100; AR within 0.01 %), a unit for every numeric field in every static tool, 12-month windows, no count in `value` for relative regions.
- In full mode the caveat texts appear once, as header lines of the text block; the JSON there lists only `caveat_codes`, while `structuredContent` keeps the full caveats.
- Every tool except `get_methodology` takes `caveats: "full" | "codes"`. `codes` replaces the caveat texts with `caveat_codes`; `get_methodology` topic `caveats` explains them.
- `outage` (caveat and month field, with `outage_affects: "modis"`) only for months whose value comes from MODIS, because `data/outages.csv` lists Aqua gaps only. Changes from Petr's first claude.ai test (beads burncal-w7p, -nmk, -j03, -17x, -zgm).
- The only MCP resource is the widget; no `burncal://methodology` resources.
- Smoke test: `cd web && npm run smoke:mcp` (production) or `node scripts/smoke-mcp.mjs <base-url> [--no-static]` calls all 16 tools over Streamable HTTP, checks `resources/list` and `resources/read` of the widget, one 2026-07-28 `server/discover` and the Origin check (foreign Origin 200 report-only or 403 enforced, claude.ai 200), checks known values (Evia Aug 2021 flagged in EL64, EL30 2007-06 back-cast band, EL62 blocks ranking, point 38.8 N 23.4 E in EL64) plus `llms.txt` and the CORS header on `/data/v1`, and exits 1 on any failure. Run it after every push to `main`.

## Web entry and demo (14 Nov 2026)

- "Use with AI" button in the web header (`web/src/ui/agent-panel.ts`, native `<dialog>`, Esc and backdrop close it): MCP URL with copy button, claude.ai and Claude Code steps, one line each for ChatGPT, Cursor and VS Code, links to `/llms.txt` and both JSON Schemas, three example prompts with a deep link each (EL64 2021, Argentine density ranking, Entre Ríos 2020). Bead burncal-a2o.
- Pitch script for the 20 s live agent segment, slide, pre-flight and fallback recording: `docs/notes/2026-11-14-agent-demo.md`. Live prompt answers from one `get_anomalies` call: EL64 Aug 2021 = 4,235 detections, median 63.1 (2011-2020), 67.1×.

## Live context tools (14 Nov 2026, branch `mcp-live`, not deployed)

Four more read-only tools fetch third-party data at call time (beads burncal-2s3). Code in `web/api/_lib/live/`, registered by `registerLiveTools(server)` from `web/api/mcp.ts`. Source research: [sources/2026-11-14-research-live-sources.md](sources/2026-11-14-research-live-sources.md).

| Tool | Inputs | Upstream | Returns |
|---|---|---|---|
| `get_fire_alerts` | `country?` or `region_id?`, `days` 1-30 (14) | GDACS event API (wildfire, all alert levels), Copernicus EMS rapid mapping activations (category Wildfire) | up to 50 items, newest first: `source`, `id`, `title`, `date`, `url`, `severity` (GDACS level and hectares), `lat`/`lon`, `matched_region`; with `region_id` only events whose point falls in the region |
| `get_fire_weather` | `region_id` or `lat`+`lon`, `from`/`to` (default today -7 to +7, max 31 days, 1940 to 15 days ahead) | Open-Meteo archive (every past day) and forecast (future days) | daily `tmax_c`, `rh_min_pct`, `wind_max_kmh`, `gust_max_kmh`, `precip_mm`, `et0_mm`, `vpd_max_kpa`, `soil_moisture_0_7cm_m3m3`, `kind` reanalysis/forecast; `summary` (maxima, total rain, 30-30-30 days, dry spell); `fire_season` from the calendar |
| `get_weather_stations` | `region_id`, `from`/`to` (default last 10 days, max 62), `max_stations` 1-5 (3) | Meteostat daily CSV per station and year | stations inside the region first, else within 75 km of its point: distance, elevation, days with measurements, `last_measured_date`, daily Tavg/Tmin/Tmax, RH, rain, wind; `model_fields` per day lists MOSMIX-filled values |
| `get_recent_detections` | `region_id`, `days` 1-10 (3) | FIRMS area API, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT` | counts per day and sensor inside the polygon, totals, top 10 hotspots by FRP, per-region counts for `GR`/`AR`, `calendar_context`: NOAA-20 per day against the median daily S-NPP VIIRS rate of the same calendar month in the last 10 calendar years; `configured: false` without `FIRMS_MAP_KEY` |

- Annotations `readOnlyHint: true`, `openWorldHint: true`, `idempotentHint: false`. Every result has `fetched_at`, `source` (name, url, licence, attribution line per upstream), `caveats`, and `region` with `view_url` when a region applies. Text block: caveat lines first, then JSON with `caveat_codes`; `caveats: "codes"` works as in the static tools.
- Caveat codes: `live_upstream` (always), `upstream_error`, `not_configured`, `provisional`, `forecast`, `model_not_station`, `single_point`, `station_lag`, `untrusted_text`, `detections_not_fires`, `nrt_not_harmonized`.
- Fixed host allowlist in `web/api/_lib/live/core.ts`: `www.gdacs.org`, `rapidmapping.emergency.copernicus.eu`, `archive-api.open-meteo.com`, `api.open-meteo.com`, `data.meteostat.net`, `firms.modaps.eosdis.nasa.gov`, HTTPS only. URLs are built from zod-validated region ids, coordinates, dates and day counts; no tool takes a URL.
- Each upstream call aborts after 4 s (function `maxDuration` 10 s); calls of one tool run in parallel. Per-instance cache: GDACS, EMS and FIRMS 10 min, Open-Meteo forecast 30 min and archive 6 h, Meteostat 1 h; failures are not cached. A failing upstream gives an `upstream_error` caveat and an empty part, never an isError or HTTP 500. Bad input (unknown region, missing point) is an isError text.
- Third-party text (titles, station names) passes `cleanText`: tags, control and bidi characters removed, whitespace collapsed, capped at 60-160 characters.
- The FIRMS key comes only from the Vercel env `FIRMS_MAP_KEY` (20-64 alphanumerics); it is masked in error texts and never returned.
- Meteostat station list: `web/api/_lib/live/meteostat-stations.ts`, generated by `web/scripts/build-meteostat-stations.py` from `data.meteostat.net/stations.db` (151 stations, 45 GR and 106 AR, with observations since 2020).
- The region point is the centroid of the region's largest polygon, or its first vertex when the centroid falls outside (EL64 gives 38.6468 N 22.8261 E, Entre Ríos 32.0583 S 59.2017 W).
- Not built: ReliefWeb (needs an approved appname), media RSS (terms per outlet), NOAA NCEI (last record 24 Aug 2025), SMN text files (no licence found, Meteostat carries SMN METARs), EFFIS FWI (GetFeatureInfo returns no attributes).
- Tests: `web/test/live-*.test.ts` (mocked fetch: parsing, allowlist, timeouts, cache, key masking, failure paths, end-to-end through the handler). Harness: `node scripts/live-harness.mjs [out-dir]` (Node 22.18+) calls each tool for Greek and Argentine regions against the real upstreams. The smoke script checks the 4 live tools and treats `upstream_error` and `not_configured` as warnings; until this branch is deployed, `tools/list` on production fails because it expects 14 tools.

Harness output, 14 Nov 2026 about 14:30 local, no FIRMS key:

| Call | Result |
|---|---|
| `get_fire_alerts` AR, 30 days | 1 item: GDACS Green, 6291 ha, 10-14 Nov 2026, matched to 34 Formosa |
| `get_fire_alerts` GR, 30 days | 0 items (no GDACS or EMS wildfire event in Greece since 16 Oct) |
| `get_fire_weather` EL64, default window | 15 days, tmax max 23.1 °C, RH min 47 %, 14.5 mm rain |
| `get_fire_weather` 38.9 N 23.3 E, 1-10 Aug 2021 | tmax max 40.3 °C, RH min 8 %, 0.6 mm rain |
| `get_weather_stations` EL52 | Thessaloniki Airport 16622, 26.5 km, 2 of 11 days measured, last 5 Nov |
| `get_weather_stations` 30 | Gualeguaychú, Paraná, Concordia aerodromes, 7-8 of 9-10 days measured, last 10-11 Nov |
| `get_recent_detections` EL64, AR | `configured: false` |
| `get_recent_detections` on production with `FIRMS_MAP_KEY` (14 Nov, 15:10, after 075f9d5), 5 days | EL64: NOAA-20 4, NOAA-21 10, MODIS 5; 30 Entre Ríos: NOAA-20 39, NOAA-21 35, MODIS 11; caveats `live_upstream`, `detections_not_fires`, `nrt_not_harmonized`, `provisional` |

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
- Origin check (burncal-0km, 14 Nov 2026): `web/api/_lib/origin.ts` wraps the handler with the SDK's `originValidationResponse`. A request without `Origin` passes (server-to-server: claude.ai and ChatGPT connectors, Claude Code, Cursor, VS Code, curl). A present `Origin` must have one of these hostnames, any scheme and port: `burning-calendar.vercel.app` (our site), `localhost`, `127.0.0.1`, `[::1]` (MCP Inspector, vite dev, vercel dev), `claude.ai`, `claude.com`, `chatgpt.com`, `chat.openai.com`. Everything else, including the opaque `null` origin, is logged (`[mcp] Origin not in allowlist`) and served: the check is report-only by default, because a 403 to an unknown web MCP client during the jury demo costs more than DNS rebinding against a public, read-only, keyless server can gain (Petr's session, 14 Nov). Env var `MCP_ORIGIN_ENFORCE=1` switches to HTTP 403 with JSON-RPC error -32000; turn it on after checking the Vercel logs for rejected origins. More hostnames: env var `MCP_ALLOWED_ORIGINS` (comma separated, for example a preview deployment), then redeploy. Whether claude.ai or ChatGPT send `Origin` at all is not verified; they are listed in case a browser-side path does.
- Region names come from NUTS and IGN through our pipeline. `tools.ts` `clean()` strips C0 controls and DEL and caps at 80 characters; the widget data use `safeText()` in `widget.ts`, which also strips C1 controls, bidi overrides and zero-width characters. Extending `clean()` the same way is open (tools.ts was edited in parallel).
- Rate limit, proposal, not applied (14 Nov 2026). Hobby allows 1 custom WAF rule per project, so it goes on the MCP endpoint only; static files are cheap and cached. claude.ai and ChatGPT call from shared cloud IP ranges, so one IP carries many users: the limit is per IP and generous. Counters are per Vercel region. Traffic blocked by WAF is not billed.
  - Rule: name `Rate limit MCP`, condition path equals `/api/mcp`, action rate limit, fixed window 60 s, 600 requests, key IP, then 429. A judge demo makes about 5 to 30 calls a minute; 600 a minute per IP still stops a loop hammering the function (10 s `maxDuration`, 4 h Active CPU a month on Hobby).
  - Roll-out: first with action `log`, check the Firewall traffic view for a day (or after the demo), then switch to 429.
  - Dashboard: project `burning-calendar` > Firewall > Configure > New Rule. If `Request Path` `Equals` `/api/mcp`, Then `Rate Limit`, Fixed Window, 60 seconds, 600 requests, key `IP Address`, follow-up action `Log` (later `Too Many Requests (429)`). Save, Review Changes, Publish.
  - CLI, from a checkout linked to the project (`cd web && vercel link`): `vercel firewall rules add "Rate limit MCP" --condition '{"type":"path","op":"eq","value":"/api/mcp"}' --action rate_limit --rate-limit-window 60 --rate-limit-requests 600 --rate-limit-keys ip --rate-limit-action log --yes`, then `vercel firewall diff` and `vercel firewall publish --yes`. To enforce: `vercel firewall rules remove "Rate limit MCP" --yes`, the same `add` with `--rate-limit-action rate_limit`, `diff`, `publish --yes`.
- The function never fetches a URL from tool input, so SSRF does not apply. The live tools fetch only from the fixed host allowlist in `web/api/_lib/live/core.ts`.
- Live upstream text reaches the model: `untrusted_text` caveat on alerts, sanitizing in `cleanText`.
- Space Apps 2026 FAQ: AI is called "Super Intelligence (SI)"; the submission must describe how SI tools were used ([space-apps-rules.md](space-apps-rules.md)).
