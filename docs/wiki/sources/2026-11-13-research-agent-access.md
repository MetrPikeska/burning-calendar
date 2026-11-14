---
title: "Research: agent access for the static map app"
date: 2026-11-13
author: research agent
sources:
  - https://modelcontextprotocol.io/specification/2026-07-28/changelog.md
  - https://modelcontextprotocol.io/specification/2026-07-28/server/tools.md
  - https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.md
  - https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning.md
  - https://github.com/vercel-labs/mcp-handler
  - https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel
  - https://vercel.com/docs/functions/limitations
  - https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
  - https://developers.openai.com/plugins/quickstart.md
  - https://modelcontextprotocol.io/extensions/client-matrix.md
  - https://github.com/modelcontextprotocol/ext-apps
  - https://github.com/mapbox/mcp-server
  - https://github.com/nasa/earthdata-mcp
  - https://llmstxt.org/
  - https://webmachinelearning.github.io/webmcp/
  - https://www.spaceappschallenge.org/resources/participant-faqs/
---

## Summary and recommendation

- **Architecture for 48 h:** keep the static MapLibre site as it is and add one Vercel Function `api/mcp.ts` in the same project, built with `mcp-handler` 2.4.0 + `@modelcontextprotocol/server` 2.x + `zod` 4. It reads the same static JSON the web app reads and has no database, no session, no secrets and no auth.
- **"No backend":** strictly it adds one serverless function, so it is no longer zero-backend. It is stateless and read-only, though, and it derives everything from the published files: if the function breaks, the map still works. On Hobby it costs nothing within the included 1,000,000 invocations and 4 h Active CPU per month. Code cost is about 300 lines of TypeScript plus a share of the anomaly code if MCP must recompute ranges.
- **Must-have (cheap, works with every agent that can fetch a URL):** stable versioned JSON URLs with CORS, a JSON Schema for `index.json` and `regions/{id}.json`, `/llms.txt`, URL-state deep links (`?region=EL52&from=2007-01&to=2007-12`), and a precomputed CSV per region next to each JSON.
- **Must-have if "agent-ready" is in the pitch:** the MCP server with 6 read-only tools (section 7), every tool annotated `readOnlyHint: true`, every result returning `structuredContent` with a `caveats` array and a `view_url` deep link.
- **Nice-to-have:** an MCP Apps widget (`ui://`) that renders the calendar in Claude, ChatGPT, VS Code or Cursor, plus the WebMCP bridge (Chrome origin trial only).
- **Jury demo in 1 minute:** claude.ai > Customize > Connectors > Add custom connector, paste the URL, no auth. This works on the Free plan (one custom connector). Fallback: `claude mcp add --transport http burncal https://<app>/api/mcp`.
- **Watch-outs:** MCP 2026-07-28 (current, stateless) is new and clients may still speak 2025-era Streamable HTTP. `mcp-handler` 2.x serves both from one handler. Pin the exact versions, because `mcp-handler` 2.4.0 was published on 12 Nov 2026, one day before this report.

## 1. MCP specification, current revision

**Revision.** The current protocol version is **2026-07-28**. The previous one, 2025-11-25, is still published. https://modelcontextprotocol.io/specification/versioning.md

**Major changes in 2026-07-28** (https://modelcontextprotocol.io/specification/2026-07-28/changelog.md):
- Protocol-level sessions and the `Mcp-Session-Id` header are removed from Streamable HTTP (SEP-2567).
- The protocol is stateless: there is no `initialize` handshake any more. Each request carries `io.modelcontextprotocol/protocolVersion` and client capabilities in `_meta` (SEP-2575).
- Servers MUST implement `server/discover` (SEP-2575).
- The HTTP GET endpoint and `resources/subscribe` are replaced by `subscriptions/listen`.
- `ping` and `logging/setLevel` are removed. Roots, Sampling and Logging are deprecated (SEP-2577).
- All results carry `resultType` (`"complete"` or `"input_required"`).
- Results of `tools/list`, `resources/list`, `resources/read` and the other list calls must carry `ttlMs` and `cacheScope` (SEP-2549).
- `inputSchema` and `outputSchema` accept any JSON Schema 2020-12 keyword, and `structuredContent` may be any JSON value (SEP-2106).
- Streamable HTTP POST requests must carry `Mcp-Method` and `Mcp-Name` headers (SEP-2243).
- Dynamic Client Registration is deprecated in favour of Client ID Metadata Documents.

**Transports.** stdio and Streamable HTTP. The old HTTP+SSE transport has been deprecated since 2025-03-26 and is reclassified as Deprecated under the new lifecycle policy (SEP-2596). https://modelcontextprotocol.io/specification/2026-07-28/changelog.md, https://modelcontextprotocol.io/specification/2026-07-28/deprecated.md
- Streamable HTTP uses a single endpoint path. Responses are either `application/json` or `text/event-stream`. Servers **MUST validate the `Origin` header** and reject an invalid Origin. https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.md
- In 2025-11-25 sessions were already optional ("A server using the Streamable HTTP transport MAY assign a session ID"), so a stateless server is valid for 2025-era clients too. https://modelcontextprotocol.io/specification/2025-11-25/basic/transports.md

**Mixed eras.** A modern-only server does not work with legacy clients: a legacy client sends `initialize` and gets `400`. A dual-era server answers `initialize` for legacy clients and serves modern requests statelessly, both on the same endpoint. https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning.md (compatibility matrix). For us this means: use a dual-era server library.

**Tools, resources, prompts.**
- Tool fields are `name`, `title`, `description`, `icons`, `inputSchema` (required, JSON Schema, default 2020-12), `outputSchema` (optional) and `annotations` (optional). Tool names SHOULD be 1 to 128 characters and case-sensitive. https://modelcontextprotocol.io/specification/2026-07-28/server/tools.md
- `structuredContent` holds a JSON value that must conform to `outputSchema` if one is given. "For backwards compatibility, a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block." (same page)
- Tool results may contain `resource_link` items and embedded resources, both carrying resource annotations. (same page)
- Annotations are `readOnlyHint`, `destructiveHint` (default true, meaningful only when readOnly is false), `idempotentHint` (default false) and `openWorldHint`. Clients MUST treat annotations as untrusted unless the server is trusted. https://raw.githubusercontent.com/modelcontextprotocol/specification/main/schema/2026-07-28/schema.ts, https://modelcontextprotocol.io/specification/2026-07-28/server/tools.md
- Servers SHOULD return `tools/list` in a deterministic order. https://modelcontextprotocol.io/specification/2026-07-28/changelog.md
- The "resource not found" error code changed from `-32002` to `-32602`. (same page)

**Auth.** "Authorization is **OPTIONAL** for MCP implementations." A public read-only server without auth complies with the spec. https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/index.md

**SDKs (versions seen 13 Nov 2026):**
- TypeScript v2 is split into packages: `@modelcontextprotocol/server` 2.4.0 (23 Oct 2026). The v1 monolith `@modelcontextprotocol/sdk` is at 1.32.2 (23 Oct 2026). https://registry.npmjs.org/@modelcontextprotocol/server, https://github.com/modelcontextprotocol/typescript-sdk
- Python `mcp` 2.3.0 (PyPI, 2 Oct 2026). Its "What's new in v2" covers the move "2025-11-25 to 2026-07-28: No handshake, no session". https://pypi.org/project/mcp/, https://py.sdk.modelcontextprotocol.io/whats-new/
- FastMCP (Python, Prefect) `fastmcp` 4.1.8 (PyPI, 10 Nov 2026). https://github.com/PrefectHQ/fastmcp. Do not confuse it with npm `fastmcp` 4.26.2, which is a different, unofficial TypeScript project (punkpeye/fastmcp). https://registry.npmjs.org/fastmcp

## 2. Hosting on Vercel

**Package.** The package is `mcp-handler` (repo vercel-labs/mcp-handler; Vercel docs link it as github.com/vercel/mcp-handler). The latest is **2.4.0, published 12 Nov 2026**. The Vercel guide (last updated 18 Sep 2026) pins `mcp-handler@2.1.1`. The old package name `@vercel/mcp-adapter` is at 0.3.2. https://registry.npmjs.org/mcp-handler, https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel, https://registry.npmjs.org/@vercel/mcp-adapter
- Install: `npm install mcp-handler@^2 @modelcontextprotocol/server@^2 zod@^4`, Node 20+. `next` is an **optional** peer dependency, and the only required peer is `@modelcontextprotocol/server` ^2.0.0. https://github.com/vercel-labs/mcp-handler, https://registry.npmjs.org/mcp-handler/2.4.0
- API: `createMcpHandler((server) => { server.registerTool(name, {title, description, inputSchema: z.object(...)}, handler) }, options)` returns a Web-standard `(Request) => Promise<Response>`. Export it as `GET` and `POST`. 1.x options like `basePath`, `maxDuration`, `redisUrl` and `sessionIdGenerator` are gone. https://github.com/vercel-labs/mcp-handler
- Protocols: it serves 2026-07-28 natively and falls back to stateless Streamable HTTP for 2025-era clients. GET/DELETE session operations answer 405. HTTP+SSE is removed in 2.x and Redis is no longer needed. (same README)
- The README advertises framework-agnostic use (Next.js, Nuxt, SvelteKit, Hono, "other Fetch-compatible frameworks").

**Plain Vercel Functions without Next.js.** Any file under `/api` is deployed as a function. Functions take a Web `Request`, through `export function GET(request)` or `export default { fetch(request) }`. https://vercel.com/docs/functions/functions-api-reference. So `api/mcp.ts` exporting the `mcp-handler` handler should work in our static project. I found no doc that shows exactly this combination (see Open points).

**Function limits** (Fluid compute, docs updated 24 Aug 2026; https://vercel.com/docs/functions/limitations, https://vercel.com/docs/functions/configuring-functions/duration):
- Duration: Hobby 300 s default and maximum. Pro 300 s default, 800 s maximum.
- Memory: Hobby 2 GB / 1 vCPU.
- Bundle: 250 MB uncompressed (500 MB for Python).
- Request and response body: 4.5 MB maximum (streamed responses are exempt).
- Default region `iad1`.
- Cold starts: Fluid compute uses bytecode caching on Node 20+ (production only) and pre-warms production deployments. https://vercel.com/docs/fluid-compute

**Hobby included usage:** 1,000,000 function invocations, 4 h Active CPU, 100 GB Fast Data Transfer. https://vercel.com/docs/limits/fair-use-guidelines

**Reading our static JSON from the function.** There are two options:
- (a) Bundle the files with `functions."api/mcp.ts".includeFiles: "public/data/**"` in `vercel.json` and read them from the filesystem. `includeFiles` is supported outside Next.js. https://vercel.com/docs/project-configuration/vercel-json
- (b) `fetch()` them from the deployment's own public URL, which the CDN caches.

Option (a) avoids an extra network hop and keeps data and server on the same deployment version. Option (b) needs no config but must know its own origin (an environment variable such as `VERCEL_URL`; not verified in this research). Recommendation: (a), since the data is a few MB at most. That is our estimate: one region file is about 302 months x about 150 bytes, roughly 45 KB.

**Alternatives.**
- Python FastMCP over stdio (`uvx`/`uv run`): no hosting, but every user needs Python and a local config, and claude.ai web cannot use it. claude.ai needs a public URL (section 3). https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
- FastMCP over HTTP elsewhere (its docs list HTTP deployment and Prefect Horizon). https://gofastmcp.com/llms.txt
- Python on Vercel exists (500 MB bundle), but I did not verify a FastMCP-on-Vercel recipe.

**Recommendation (one):** a TypeScript `api/mcp.ts` with `mcp-handler` 2.4.0 (exact pin) in the same Vercel project as the static site, with data bundled through `includeFiles`. Cost: Hobby is free; build time is about 4 to 6 h for 6 tools plus tests with MCP Inspector (`npx @modelcontextprotocol/inspector@latest`, https://developers.openai.com/plugins/deploy/connect-chatgpt.md). The 4 to 6 h is our own estimate. Catch: our pipeline is Python, so any computation the MCP server does beyond reading JSON (custom-range anomalies) must be written in TS. The web app already needs that JS code ([decisions.md](../decisions.md)), so share one TS module between web and function.

## 3. Clients

| Client | How | Auth / plan | Source |
|---|---|---|---|
| claude.ai, Claude Desktop, Cowork | Customize > Connectors > "+ Add" > "Add custom connector", name + URL, review detected auth, Add | Free, Pro, Max, Ultra, Team, Enterprise. **Free: one custom connector.** Claude connects from Anthropic's cloud, so the server must be publicly reachable, even for Desktop. | https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp |
| Claude Code | `claude mcp add --transport http <name> <url>`. SSE is deprecated. Since v2.1.265 Claude Code tries HTTP first and falls back to SSE. | None needed for an authless server | https://code.claude.com/docs/en/mcp.md |
| ChatGPT | chatgpt.com/plugins > "+" > "Add custom MCP server", URL, "No authentication", accept risk warning, "Create as a plugin", install, then use it in a **Work** chat via `@`. Developer mode is no longer the entry point in the current docs. | Supports "SSE and streaming HTTP". Plan availability is not stated on developers.openai.com. Business/Enterprise/Edu: full support, Business only admins/owners (UNVERIFIED-SNIPPET, help.openai.com/articles/12584461 blocks automated fetches). Plus/Pro: read-only or fetch-only per third-party guides (UNVERIFIED-SNIPPET). Free: none (UNVERIFIED-SNIPPET). | https://developers.openai.com/plugins/quickstart.md, https://developers.openai.com/api/docs/guides/custom-mcp-server.md |
| Cursor | Customize page or `mcp.json`. Transports: stdio, SSE, Streamable HTTP. Supports the MCP Apps extension. | OAuth if the server asks | https://cursor.com/docs/mcp |
| VS Code (Copilot) | Chat: Open Customizations > MCP Servers > Add Server > "HTTP (HTTP or Server-Sent Events)", URL, ID; or `.mcp.json` at the workspace root. MCP Apps marked experimental. | Copilot account | https://code.visualstudio.com/docs/copilot/customization/mcp-servers |

ChatGPT treats a tool without `readOnlyHint` as a write action and asks the user for confirmation. https://developers.openai.com/api/docs/guides/custom-mcp-server.md. So `readOnlyHint: true` matters for a smooth demo.

**What a jury member can do in 1 minute:** on claude.ai (any plan, Free included), add the connector URL with no auth and ask "When does the burning season peak in Central Macedonia, and was 2007 anomalous?" A pre-recorded fallback is wise, since a Free account may already have used its one custom connector. ChatGPT needs a paid or Business plan and the Work tab, so it is not a 1-minute path for a random judge.

## 4. UI in chat: MCP Apps and the OpenAI Apps SDK

- **MCP Apps** is an official extension, identifier `io.modelcontextprotocol/ui`. Spec status: **Stable (2026-01-26)**, from SEP-1865. A `draft` folder also exists. https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx, https://modelcontextprotocol.io/extensions/client-matrix.md
- The SDK is `@modelcontextprotocol/ext-apps` 2.0.4 (27 Oct 2026). https://registry.npmjs.org/@modelcontextprotocol/ext-apps
- **Support (community-maintained matrix, source read 13 Nov 2026):** Claude web, Claude Desktop, VS Code GitHub Copilot, Goose, ChatGPT and Cursor support MCP Apps. MCP Inspector has partial support. The matrix does **not** list Claude Code. https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/extensions/client-matrix.mdx. The Mapbox MCP README says Claude Code renders it (✅), which conflicts with the matrix. https://github.com/mapbox/mcp-server
- **Declaration:** register a resource with URI `ui://...` and `mimeType: "text/html;profile=mcp-app"`, then link the tool to it with `_meta: { ui: { resourceUri } }`. ChatGPT also accepts the older `_meta["openai/outputTemplate"]` as an alias. https://developers.openai.com/plugins/llms-full.txt (section "Add UI to your MCP server")
- External origins are declared in `_meta.ui.csp` with `connectDomains`, `resourceDomains` and `frameDomains`. A tool with `visibility: ["app"]` can be hidden from the model and called only by the widget. https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- **Map precedent:** the official ext-apps `examples/map-server` renders a CesiumJS globe. It declares OSM and Cesium domains in `connectDomains`/`resourceDomains` and uses `registerAppResource` / `registerAppTool` from `@modelcontextprotocol/ext-apps/server`. https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/map-server. A MapLibre widget would declare our tile host the same way.

Minimal shape (adapted from the ext-apps map example, not tested):

```ts
registerAppResource(server, "ui://burncal/calendar.html", "ui://burncal/calendar.html",
  { mimeType: RESOURCE_MIME_TYPE },
  async () => ({ contents: [{ uri: "ui://burncal/calendar.html", mimeType: RESOURCE_MIME_TYPE,
    text: html, _meta: { ui: { csp: { connectDomains: ["https://<app>.vercel.app"],
                                       resourceDomains: ["https://<tile-host>"] } } } }] }));
registerAppTool(server, "show_calendar", { title: "Show burning calendar", description: "...",
  inputSchema: z.object({ region_id: z.string() }), _meta: { ui: { resourceUri: "ui://burncal/calendar.html" } } },
  async ({ region_id }) => ({ content: [{ type: "text", text: "..." }], structuredContent: { ... } }));
```

- Mapbox's guide says several hosts (Claude Desktop among them) fully render the panel only for the *last* tool call in a sequence. Mapbox therefore uses one terminal render tool and keeps data tools UI-free. Vendor claim, not checked against the hosts. https://github.com/mapbox/mcp-server/blob/main/docs/render-map-tool.md. OpenAI recommends the same decoupled pattern: a data tool without a template, plus a render tool that owns the template. https://developers.openai.com/plugins/llms-full.txt
- Verdict for 48 h: a calendar heat-strip widget (12 months x N years, no basemap) is feasible and needs no tile CSP. A full map widget is nice-to-have.

## 5. Agent-ready web without MCP

- **llms.txt** (llmstxt.org, now "v2"): a Markdown file at `/llms.txt` or at any subpath. The H1 is the only required section, followed by a blockquote summary, optional prose, and H2 sections with link lists (`[name](url): notes`). A section named "Optional" holds links an agent may skip. Linked pages should be LLM-friendly, for example a `.md` twin of each HTML page. https://llmstxt.org/
- **JSON Schema:** the current version is 2020-12. https://json-schema.org/specification. MCP `inputSchema`/`outputSchema` default to 2020-12 as well, so one schema file serves the docs, an OpenAPI description and the MCP `outputSchema`.
- **OpenAPI:** the latest is 3.2.1 (10 Sep 2026). https://spec.openapis.org/oas/latest.html. Describing static files as `GET /data/v1/regions/{id}.json` paths is legitimate, and optional for us because llms.txt plus JSON Schema already covers agents that fetch.
- **CORS on Vercel:** set `Access-Control-Allow-Origin: *` on `/data/(.*)` through the `headers` key in `vercel.json`. https://vercel.com/kb/guide/how-to-enable-cors, https://vercel.com/docs/project-configuration/vercel-json (`headers` section).
- **Stable URLs:** put a version in the path (`/data/v1/...`) and keep `schema_version` in `index.json`. That is our own design choice, consistent with [data-contract.md](../data-contract.md).
- **Deep links:** URL state such as `?region=EL52&from=2007-01&to=2007-12&mode=harmonized` lets an agent hand a user a link to the exact view, and every MCP result can return it as `view_url`. Precedent: NASA's `get_tools` returns "deep-linking templates" for Worldview and Giovanni. https://github.com/nasa/earthdata-mcp
- **CSV:** a precomputed `regions/{id}.csv` costs the pipeline a few lines. An agent without a browser can fetch it, while JS-only export is invisible to agents. Keep JS export for user-picked ranges. This is our own reasoning.
- **WebMCP:**
  - W3C Web Machine Learning Community Group draft report dated 12 Nov 2026, not on the standards track. The current API hangs off `Document` (`document.modelContext`). https://webmachinelearning.github.io/webmcp/
  - Chrome: origin trial from **Chrome 149**, plus the local flag `chrome://flags/#enable-webmcp-testing`. The page was last updated 7 Oct 2026. https://developer.chrome.com/docs/ai/webmcp
  - `mcp-handler` has an experimental bridge, `experimental_webMcp: { tools: [...] }` plus `<script src="/api/mcp?webmcp-script">`, which also supports the older `navigator.modelContext` and targets 2025-06-18 stateless endpoints. https://github.com/vercel-labs/mcp-handler/blob/main/docs/WEBMCP.md
  - Verdict: nice-to-have and cheap (about 5 lines) once the MCP server exists. Few judges will run a browser with a WebMCP agent.

## 6. Geo / EO precedents

| Server | Maintainer | Tools (examples) | Geometry and series handling | Size control |
|---|---|---|---|---|
| NASA Earthdata MCP, remote at `https://cmr.earthdata.nasa.gov/mcp/v1` (Streamable HTTP) | **Official** (nasa/earthdata-mcp, FastMCP-based) | `get_keywords`, `get_collections`, `get_granules`, `get_services`, `get_tools`, `get_citations`, `get_variables` | Spatial input as WKT (`spatial_wkt_geometry`) or `bounding_box` [W,S,E,N]; returns metadata and links (portals, deep-link templates), not data arrays | All search tools take `limit`, `cursor`, `fields`; Harmony links paged in memory, default 10. Recommended client timeout 60 s. |
| Mapbox MCP, hosted at `https://mcp.mapbox.com/mcp`, v0.18.0 (11 Nov 2026) | **Official** (mapbox/mcp-server) | `search_and_geocode_tool`, `directions_tool`, `isochrone_tool`, `ground_location_tool`, `render_map_tool`, `static_map_image_tool`, offline Turf-style tools | Big geometry is kept out of the model: tools return a short `structuredContent.mapboxRender.ref` (`payload_refs`) that `render_map_tool` resolves. Static PNG fallback for clients without MCP Apps. Resources (`mapbox://categories`) plus a `resource_reader_tool` fallback for clients without resource support. | Mapbox token required |
| Esri MCP for ArcGIS Location Services | **Official, beta** (Esri-hosted) | Geocoding, routing, elevation, static maps (tool names not checked) | not checked | not checked; https://developers.arcgis.com/ai/mcp-arcgis-location-services/ |
| NASA FIRMS | **Community only**: pipeworx-io/mcp-nasa-firms ("independent, unofficial"), tyson-swetnam/nasa-firms-mcp (repo has only a README) | `firms_hotspots_area`, `firms_hotspots_near`, `firms_data_availability` | Detection rows; recommends calling availability first so an empty result reads as "outside the archive", not "no fires" | `limit`; needs a MAP_KEY (5,000 transactions per 10 min per that README) |
| STAC | Community (BnJam/stac-mcp) | `search_collections`, `search_items`, `get_item`, `get_queryables`, `estimate_data_size` | `bbox` or GeoJSON `intersects` input; `output_format` `text` (default) or `json` envelope | `limit`; size estimate tool |
| OpenStreetMap | Community (jagan-shanmugam/open-streetmap-mcp, about 234 stars) | `geocode_address`, `reverse_geocode`, `find_nearby_places`, `explore_area`, `get_route_directions` | Summaries | not checked |
| Google Earth Engine | **No official server found**; community (cameronking4/google-earth-engine-mcp, Dhenenjay) | not checked | not checked | Needs GEE credentials |

Lessons for us:
- Return links and summaries by default, not raw arrays (NASA, Mapbox).
- Support `limit` and `fields` (NASA).
- Expose methodology as a resource *and* through a tool fallback (Mapbox).
- Give empty results a meaning ("no detections" vs "outside coverage" vs "sensor outage") (FIRMS community server).

## 7. Proposed tool surface

All tools: `annotations: { readOnlyHint: true, openWorldHint: false }`, deterministic order, `outputSchema` generated from the published JSON Schema, an enum for `country` (`GR`, `AR`), a regex for `region_id` and `YYYY-MM` patterns for dates. Each result returns `structuredContent` plus one short text block. The spec says the text block SHOULD be the serialized JSON. Send compact JSON preceded by a 1 to 3 sentence summary: a deviation from the SHOULD, chosen deliberately for tokens.

| Tool | Inputs | Output (structuredContent) | Change vs starting point |
|---|---|---|---|
| `search_regions` | `country?`, `level?` (`nuts2`, `nuts3`, `province`, `department`), `query?` (name, accent and case insensitive), `limit` (default 50) | `[{id, name, level, parent, mode, peak_month, season_length, view_url}]` | Merges `list_regions` and name lookup |
| `find_region_at` | `lat`, `lon`, `level?` | `{id, name, level, parent, mode, view_url}` or `{found: false}` | Point-in-polygon only; name search moves to `search_regions`. Needs geometry in the function: bundle the topojson. |
| `get_region_series` | `region_id`, `from`, `to`, `aggregate` (`month` default, `year`), `fields?` | `{region, mode, unit: "VIIRS-equivalent detections", records: [...], caveats, view_url, data_url, csv_url}` | Hard cap 120 monthly records per call; beyond that, require `aggregate: "year"` or return `truncated: true` with the next `from` |
| `get_season_calendar` | `region_id`, `year?` | Climatology (`peak_month`, `onset`, `end`, `season_length`, `season_start_month`, `bimodal`) plus per-year metrics for one year or all | Renamed from `get_calendar` so the model does not confuse it with a date calendar |
| `get_anomalies` | `region_id`, `year` | Monthly percentile rank vs the preceding 10 years, flagged months, baseline years used | Precomputed values only in the MVP; custom ranges only if the TS anomaly module is shared with the web |
| `compare_regions` | `region_ids` (2 to 10), `metric` (enum: `annual_total`, `peak_month`, `season_length`, `onset`), `year?` | Table rows plus per-row `mode` and caveats | Refuses to rank absolute totals across regions where any region is `relative` |
| `get_methodology` | `topic?` (`harmonization`, `uncertainty`, `flags`, `relative_mode`) | Markdown text | Mirrors resource `burncal://methodology/{topic}`; tool fallback per the Mapbox precedent, since resource support varies by client |

**Carrying uncertainty and flags into the answer:**
- Every result has a machine-readable `caveats` array, for example `{code: "backcast", months: 132, note: "2000-2011 back-cast from MODIS; 80% range in harm_lo..harm_hi"}`, `{code: "relative_mode", note: "absolute VIIRS-equivalent counts not available for this region; use ranks only"}`, `{code: "outage", months: ["2016-03"]}`, `{code: "backcast_terra"}`.
- The text summary puts caveats first, in words, so a model that reads only text still sees them.
- Tool descriptions say "Use this when..." and "When src is backcast, report harm with harm_lo..harm_hi". OpenAI advises "Use this when..." phrasing and server `instructions` whose first 512 characters are self-contained. https://developers.openai.com/api/docs/guides/custom-mcp-server.md. Where `instructions` lives in 2026-07-28 (server/discover result) is not verified.
- Never return `harm: null` silently. In `relative` mode, return `harm` omitted plus the caveat, and `modis`/`viirs` raw.
- Return `view_url` (deep link) and `csv_url` in every result so the agent can hand the user a link instead of pasting long tables.

**Size control:** 302 months x about 150 bytes is about 45 KB, about 12k tokens per full region (our estimate). Hence the 120-record cap, `fields`, `aggregate: "year"`, and links instead of geometry. No tool returns geometry; the map lives behind `view_url`.

## 8. Security and rules

- **Spec requirements:** servers MUST validate inputs, implement access controls, **rate limit tool invocations** and sanitize outputs. Clients SHOULD validate tool results before passing them to the LLM. https://modelcontextprotocol.io/specification/2026-07-28/server/tools.md (Security Considerations). Streamable HTTP servers MUST validate `Origin`. https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.md. I did not check whether `mcp-handler` does this itself.
- **Security best practices page** (2026-07-28 docs) covers: confused deputy, token passthrough, SSRF, state handle hijacking, local server compromise, OAuth URL validation, scope minimization. Most of it concerns auth and proxies. With no auth, no outbound fetch from user input and no state, SSRF and token issues do not apply as long as the function never fetches a URL taken from tool input. https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md
- **Prompt injection via data:** our strings are region names from NUTS 2024 and IGN, written by our pipeline. Risk is low. Still: strip control characters, cap name length, keep names only in fields, never in instructions. OpenAI warns that untrusted servers can trick the model into misusing tools. https://developers.openai.com/api/docs/guides/custom-mcp-server.md
- **Rate limiting on Vercel:** WAF rate limiting is available on all plans. Hobby gets **1 rule per project** (within 3 custom rules), fixed window of 10 s to 10 min, keys IP or JA4 digest, and 1,000,000 allowed requests included. https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
  - Catch: claude.ai calls come from Anthropic's IP ranges (https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp), so a per-IP limit lumps all Claude users together. Set it generously (for example 300 requests per minute on `/api/mcp`; our number).
  - Read-only static responses also allow `Cache-Control` on `resources/read`, and the spec's `ttlMs`/`cacheScope: "public"` applies there too.
- **Space Apps 2026 AI rule:** the participant FAQ says AI is called "Super Intelligence (SI)" in 2026, per a 29 Sep 2026 U.S. Executive Order. "Participants may use SI tools ... Each team's project submission must include a description of how SI tools were used during the development of their project." The FAQ also says the Project Submission Guide and the Judging & Awards Guide become available on 13 November. https://www.spaceappschallenge.org/resources/participant-faqs/. Fetched with TLS verification disabled, because certificate verification fails from our machine (as noted in [space-apps-rules.md](../space-apps-rules.md)). This confirms the UNVERIFIED-SNIPPET on that page. An MCP server is a product feature, not "SI use", but the disclosure should mention coding assistants and any research agents.

## Open points

- That `api/mcp.ts` with `mcp-handler` 2.4.0 runs as a plain Vercel Function in a non-Next static project: plausible from both docs, but no doc shows this combination. Test it first (hour 1). The fallback is a Hono route.
- Whether `mcp-handler` validates `Origin` itself, and how it sets `ttlMs`/`cacheScope`.
- How many clients the jury will use already speak 2026-07-28 vs 2025-era Streamable HTTP. A dual-era handler should make this moot.
- ChatGPT plan availability for custom MCP servers (Plus/Pro read-only? Free none?). help.openai.com could not be fetched.
- Claude Code MCP Apps rendering: the extension matrix says no, Mapbox's README says yes.
- The Mapbox claim that hosts render only the last tool's UI panel.
- Where the server-wide `instructions` text goes under 2026-07-28 (`server/discover`?), and whether Claude and ChatGPT show resources to the model or only to the user.
- Vercel behaviour when Hobby included usage runs out (pause vs block), and the env var name for the deployment's own URL.
- Esri MCP tool names and limits; whether an official Google Earth Engine MCP exists.
- Which consumer agents actually call WebMCP tools today.
- All token and size numbers in section 7 are our estimates until the pipeline writes real files.
