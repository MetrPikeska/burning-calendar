#!/usr/bin/env node
// Smoke test of a deployed MCP endpoint and the static agent layer.
// Usage: node scripts/smoke-mcp.mjs [base-url] [--no-static]   (default: production)
// --no-static skips llms.txt and /data (for a local server that serves only the function).
// Calls every tool once over Streamable HTTP (2025-06-18 era, stateless), checks key fields
// and known values, the MCP Apps resource, one 2026-07-28 request and the Origin check,
// live tools: upstream_error / not_configured only warn. Prints one line per check, exits 1 on any failure.

const args = process.argv.slice(2);
const STATIC = !args.includes("--no-static");
const BASE = (args.find((a) => !a.startsWith("--")) ?? "https://burning-calendar.vercel.app").replace(/\/$/, "");
const MCP = `${BASE}/api/mcp`;
const TOOLS = [
  "search_regions", "get_region_series", "get_season_calendar", "get_anomalies", "compare_regions",
  "aggregate", "rank_regions", "find_region_at", "get_validation", "get_methodology", "show_calendar",
];
const WIDGET_URI = "ui://burning-calendar/calendar-v1.html";
const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "smoke-mcp", version: "1" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
// Live context tools (third-party upstreams): upstream_error or not_configured is a warning, not a failure.
const LIVE_TOOLS = ["get_fire_alerts", "get_fire_weather", "get_weather_stations", "get_recent_detections"];

let id = 0;
/** modern: 2026-07-28 request (per-request _meta envelope plus MCP-Protocol-Version and Mcp-Method headers). */
async function post(method, params, { modern = false, origin } = {}) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": modern ? "2026-07-28" : "2025-06-18",
  };
  if (modern) headers["mcp-method"] = method;
  if (origin) headers.origin = origin;
  const p = modern ? { ...params, _meta: MODERN_META } : params;
  return fetch(MCP, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: p }),
    signal: AbortSignal.timeout(30_000),
  });
}

async function rpc(method, params, opts) {
  const res = await post(method, params, opts);
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  // SSE: take the last `data:` line; plain JSON otherwise.
  const data = body.includes("data:") ? body.split("\n").filter((l) => l.startsWith("data:")).pop().slice(5) : body;
  const msg = JSON.parse(data);
  if (msg.error) throw new Error(`JSON-RPC ${msg.error.code}: ${msg.error.message}`);
  return msg.result;
}

const call = (name, args) => rpc("tools/call", { name, arguments: args });

function must(cond, what) {
  if (!cond) throw new Error(what);
}

/** Checks shared by every data tool. */
function common(r, { countries = null } = {}) {
  must(!r.isError, `isError: ${r.content?.[0]?.text?.slice(0, 200)}`);
  const s = r.structuredContent;
  must(s, "no structuredContent");
  must(s.coverage?.start === "2000-11" && /^\d{4}-\d\d$/.test(s.coverage?.end ?? ""), "coverage missing");
  must(Array.isArray(s.caveats ?? s.caveat_codes), "caveats missing");
  must(s.source?.method_version, "source.method_version missing");
  if (countries) {
    const got = s.source.details.map((u) => u.match(/v1\/(\w+)\//)[1]).join(",");
    must(got === countries, `source.details countries ${got}, expected ${countries}`);
  }
  return s;
}

const checks = [
  ["tools/list", async () => {
    const r = await rpc("tools/list", {});
    const names = r.tools.map((t) => t.name).sort();
    must(JSON.stringify(names) === JSON.stringify([...TOOLS, ...LIVE_TOOLS].sort()), `tools: ${names.join(",")}`);
    must(r.tools.every((t) => t.annotations?.readOnlyHint === true), "a tool lacks readOnlyHint");
    must(r.tools.filter((t) => LIVE_TOOLS.includes(t.name)).every((t) => t.annotations?.openWorldHint === true), "a live tool lacks openWorldHint");
    const cal = r.tools.find((t) => t.name === "show_calendar");
    must(cal._meta?.ui?.resourceUri === WIDGET_URI, "show_calendar lacks _meta.ui.resourceUri");
    return `${names.length} tools, all readOnlyHint, show_calendar -> ${WIDGET_URI}`;
  }],
  ["resources/list", async () => {
    const r = await rpc("resources/list", {});
    const w = r.resources.find((x) => x.uri === WIDGET_URI);
    must(w?.mimeType === "text/html;profile=mcp-app", `widget resource missing: ${JSON.stringify(r.resources)}`);
    const read = await rpc("resources/read", { uri: WIDGET_URI });
    const html = read.contents[0].text;
    must(html.startsWith("<!doctype html>") && html.includes("ui/initialize"), "widget HTML unexpected");
    return `${WIDGET_URI}, ${html.length} chars`;
  }],
  ["show_calendar", async () => {
    const r = await call("show_calendar", { region_id: "EL64", from: "2021-01", to: "2021-12" });
    const s = common(r, { countries: "gr" });
    must(s.months.length === 12 && s.months.find((m) => m.ym === "2021-08")?.anom === true, "EL64 2021-08 cell not flagged");
    must(r.content[0].text.startsWith("CAVEAT ") && !r.content[0].text.includes('"months":['), "text block should have caveats first and no cells");
    return `EL64 2021: 12 cells, max ${s.max_value}, ${s.view_url}`;
  }],
  ["search_regions", async () => {
    const s = common(await call("search_regions", { country: "GR" }), { countries: "gr" });
    must(s.regions.length === 14, `GR regions ${s.regions.length}, expected 14`);
    return `${s.regions.length} GR regions`;
  }],
  ["get_region_series", async () => {
    const s = common(await call("get_region_series", { region_id: "EL30", from: "2007-06", to: "2007-08" }), { countries: "gr" });
    const jun = s.records.find((m) => m.ym === "2007-06");
    must(jun?.src === "backcast" && jun.harm_lo < jun.harm && jun.harm < jun.harm_hi, "2007-06 back-cast band missing");
    must(s.caveats.some((c) => c.code === "backcast"), "backcast caveat missing");
    return `EL30 2007-06 harm ${jun.harm} (${jun.harm_lo}..${jun.harm_hi})`;
  }],
  ["get_season_calendar", async () => {
    const s = common(await call("get_season_calendar", { region_id: "30", year: 2020 }), { countries: "ar" });
    return `Entre Ríos peak month ${s.climatology?.peak_month ?? s.summary?.peak_month ?? "?"}`;
  }],
  ["get_anomalies", async () => {
    const s = common(await call("get_anomalies", { region_id: "EL64", year: 2021, caveats: "codes" }), { countries: "gr" });
    must(s.flagged.includes("2021-08"), `Evia Aug 2021 not flagged: ${s.flagged}`);
    const aug = s.months.find((m) => m.ym === "2021-08");
    return `EL64 2021-08 = ${aug.value}, ${aug.ratio_to_median}x median`;
  }],
  ["compare_regions", async () => {
    const s = common(await call("compare_regions", { region_ids: ["EL30", "EL62"], metric: "annual_mean", caveats: "codes" }), { countries: "gr" });
    must(s.ranking_allowed === false, "EL62 is relative, ranking must be refused");
    return "relative region blocks ranking";
  }],
  ["aggregate", async () => {
    const s = common(await call("aggregate", { region_ids: ["30", "82"], from: "2020-01", to: "2020-12", caveats: "codes" }), { countries: "ar" });
    must(s.regions.length === 2 && s.total > 0 && s.top_months.length > 0, "no totals or top months");
    return `Entre Ríos + Santa Fe 2020: ${s.total} (${s.series}), top ${s.top_months[0].ym}`;
  }],
  ["rank_regions", async () => {
    const s = common(await call("rank_regions", { metric: "density_per_1000km2", country: "GR", top: 3, caveats: "codes" }), { countries: "gr" });
    must(s.ranked.length === 3, "expected 3 rows");
    return s.ranked.map((r) => r.id).join(" > ");
  }],
  ["find_region_at", async () => {
    const s = common(await call("find_region_at", { lat: 38.8, lon: 23.4, caveats: "codes" }), { countries: "gr" });
    must(s.found && s.id === "EL64", `Evia point gave ${s.id}`);
    must(s.detections_csv_url?.endsWith("/data/v1/gr/detections/EL64.csv"), "detections_csv_url missing");
    return "Evia -> EL64";
  }],
  ["get_validation", async () => {
    const s = common(await call("get_validation", { region_id: "GR", caveats: "codes" }), { countries: "gr" });
    return `GR validation, ${JSON.stringify(s).length} chars`;
  }],
  ["get_methodology", async () => {
    const r = await call("get_methodology", { topic: "caveats" });
    must(!r.isError && r.content[0].text.includes("backcast"), "caveats topic missing backcast");
    return "topic caveats";
  }],
];
checks.push(
  ["2026-07-28 discover", async () => {
    const r = await rpc("server/discover", {}, { modern: true });
    must(r.supportedVersions?.includes("2026-07-28"), `supportedVersions ${r.supportedVersions}`);
    return `supportedVersions ${r.supportedVersions.join(",")}`;
  }],
  ["origin check", async () => {
    const bad = await post("tools/list", {}, { origin: "https://evil.example" });
    must(bad.status === 403 || bad.ok, `foreign Origin got HTTP ${bad.status}, expected 403 (enforced) or 200 (report-only)`);
    const good = await post("tools/list", {}, { origin: "https://claude.ai" });
    must(good.ok, `claude.ai Origin got HTTP ${good.status}`);
    return `evil.example ${bad.status} (${bad.status === 403 ? "enforced" : "report-only"}), claude.ai 200`;
  }],
);

/** Checks shared by the live tools; returns the warning codes (upstream_error, not_configured) found. */
function live(r) {
  must(!r.isError, `isError: ${r.content?.[0]?.text?.slice(0, 200)}`);
  const s = r.structuredContent;
  must(s && s.fetched_at && Array.isArray(s.source) && s.source.every((x) => x.attribution), "fetched_at or source missing");
  const codes = s.caveat_codes ?? s.caveats.map((c) => c.code);
  must(codes[0] === "live_upstream", "live_upstream caveat missing");
  must(r.content[0].text.startsWith("CAVEAT"), "text block does not start with caveats");
  return { s, warn: codes.filter((c) => c === "upstream_error" || c === "not_configured") };
}
const liveChecks = [
  ["get_fire_alerts", async () => {
    const { s, warn } = live(await call("get_fire_alerts", { country: "AR", days: 30 }));
    return { warn, info: `${s.count} AR events in 30 days` };
  }],
  ["get_fire_weather", async () => {
    const { s, warn } = live(await call("get_fire_weather", { region_id: "EL64", caveats: "codes" }));
    must(warn.length || s.days.length >= 10, `only ${s.days.length} days`);
    return { warn, info: `EL64 ${s.days.length} days, tmax max ${s.summary.tmax_c_max} C` };
  }],
  ["get_weather_stations", async () => {
    const { s, warn } = live(await call("get_weather_stations", { region_id: "30", caveats: "codes" }));
    return { warn, info: `Entre Ríos ${s.stations.length} stations, last measured ${s.stations[0]?.last_measured_date ?? "-"}` };
  }],
  ["get_recent_detections", async () => {
    const { s, warn } = live(await call("get_recent_detections", { region_id: "EL64", days: 3, caveats: "codes" }));
    return { warn, info: s.configured ? `EL64 VIIRS N20 ${s.totals.viirs_noaa20} in 3 days` : "FIRMS_MAP_KEY not set" };
  }],
];

const staticChecks = [
  ["static: llms.txt", async () => {
    const res = await fetch(`${BASE}/llms.txt`);
    must(res.ok && (await res.text()).startsWith("# "), `llms.txt HTTP ${res.status}`);
    return "ok";
  }],
  ["static: hotspot CSV", async () => {
    const res = await fetch(`${BASE}/data/v1/gr/detections/EL64.csv`);
    must(res.ok, `HTTP ${res.status}`);
    const lines = (await res.text()).trimEnd().split("\n");
    must(lines[0].startsWith("region_id,sensor,satellite,acq_date,acq_time"), "unexpected header");
    return `EL64 ${lines.length - 1} detections`;
  }],
  ["static: data CORS", async () => {
    const res = await fetch(`${BASE}/data/v1/gr/index.json`);
    must(res.ok, `HTTP ${res.status}`);
    must(res.headers.get("access-control-allow-origin") === "*", "no CORS header");
    const ix = await res.json();
    return `gr index ${ix.regions.length} regions, generated ${ix.generated_at}`;
  }],
];

let failed = 0;
let warned = 0;
console.log(`smoke ${BASE}`);
checks.push(...liveChecks);
if (STATIC) checks.push(...staticChecks);
for (const [name, fn] of checks) {
  const t0 = performance.now();
  try {
    const out = await fn();
    const { warn = [], info = out } = typeof out === "object" ? out : {};
    if (warn.length) warned++;
    console.log(`${warn.length ? "WARN" : "ok  "} ${name.padEnd(20)} ${String(Math.round(performance.now() - t0)).padStart(5)} ms  ${info}${warn.length ? ` (${warn.join(", ")})` : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name.padEnd(20)} ${String(Math.round(performance.now() - t0)).padStart(5)} ms  ${e.message}`);
  }
}
console.log(failed ? `${failed} of ${checks.length} checks failed` : `all ${checks.length} checks passed${warned ? `, ${warned} with live warnings` : ""}`);
process.exit(failed ? 1 : 0);
