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
- Smoke test passed 14 Nov 2026: `web/api/mcp.ts` exports the handler as `GET` and `POST` in a plain Vercel function (framework `vite`, no Next.js); `initialize` and `tools/call` answer 200 over SSE on the production URL, and the tool reads `public/data/v1/**` bundled by `includeFiles`. Pinned: `mcp-handler` 2.4.0, `@modelcontextprotocol/server` 2.4.0, `zod` 4.6.7. A 2026-07-28 request without the per-request `_meta` envelope gets HTTP 400 (the SDK requires it); 2025-era clients work. Hono fallback not needed.
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

## Proposed tools

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
