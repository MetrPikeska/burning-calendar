#!/usr/bin/env node
// Local harness for the live context tools: runs the MCP handler in-process (no server) and calls each
// live tool for one Greek and one Argentine region against the real upstreams.
// Needs Node >= 22.18 (type stripping for the .ts imports):  node scripts/live-harness.mjs [out-dir]
// FIRMS: set FIRMS_MAP_KEY in your shell to test get_recent_detections; without it the tool reports not_configured.
// Prints one line per call; with out-dir also writes the full structuredContent per call as JSON.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { POST } from "../api/mcp.ts";

const OUT = process.argv[2];
if (OUT) mkdirSync(OUT, { recursive: true });

let id = 0;
async function call(name, args) {
  const req = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
  });
  const res = await POST(req);
  const body = await res.text();
  const data = body.includes("data:") ? body.split("\n").filter((l) => l.startsWith("data:")).pop().slice(5) : body;
  const msg = JSON.parse(data);
  if (msg.error) throw new Error(`JSON-RPC ${msg.error.code}: ${msg.error.message}`);
  return msg.result;
}

const summary = {
  get_fire_alerts: (s) => `${s.count} items` + (s.items[0] ? `, newest ${s.items[0].date} ${s.items[0].source} "${s.items[0].title.slice(0, 60)}" -> ${s.items[0].matched_region?.id ?? "-"}` : ""),
  get_fire_weather: (s) => `${s.days.length} days at ${s.point.lat},${s.point.lon}; tmax max ${s.summary.tmax_c_max} C, rh min ${s.summary.rh_min_pct_min} %, precip ${s.summary.precip_mm_total} mm, hot-dry-windy ${s.summary.days_hot_dry_windy}`,
  get_weather_stations: (s) => s.stations.map((st) => `${st.id} ${st.name} ${st.distance_km} km ${st.inside_region ? "in" : "out"}, ${st.days_with_measurements}/${st.days_returned} measured, last ${st.last_measured_date}`).join("; ") || s.note,
  get_recent_detections: (s) => s.configured
    ? `N20 ${s.totals.viirs_noaa20}, N21 ${s.totals.viirs_noaa21}, MODIS ${s.totals.modis}; baseline ${s.calendar_context?.median_per_day}/day vs N20 ${s.calendar_context?.nrt_viirs_noaa20_per_day}/day`
    : "configured: false",
};

const cases = [
  ["get_fire_alerts", { country: "GR", days: 30 }],
  ["get_fire_alerts", { country: "AR", days: 30 }],
  ["get_fire_alerts", { region_id: "EL64", days: 30 }],
  ["get_fire_weather", { region_id: "EL64", caveats: "codes" }],
  ["get_fire_weather", { region_id: "30", caveats: "codes" }],
  ["get_fire_weather", { lat: 38.9, lon: 23.3, from: "2021-08-01", to: "2021-08-10", caveats: "codes" }],
  ["get_weather_stations", { region_id: "EL52", caveats: "codes" }],
  ["get_weather_stations", { region_id: "30", caveats: "codes" }],
  ["get_recent_detections", { region_id: "EL64", days: 3, caveats: "codes" }],
  ["get_recent_detections", { region_id: "AR", days: 7, caveats: "codes" }],
];

let failed = 0;
for (const [name, args] of cases) {
  const t0 = performance.now();
  try {
    const r = await call(name, args);
    const s = r.structuredContent;
    const ms = Math.round(performance.now() - t0);
    if (r.isError || !s) throw new Error(r.content?.[0]?.text ?? "no structuredContent");
    const codes = (s.caveat_codes ?? s.caveats.map((c) => c.code)).join(",");
    const warn = codes.includes("upstream_error") ? "WARN" : "ok  ";
    console.log(`${warn} ${name} ${JSON.stringify(args)} ${ms} ms\n     ${summary[name](s)}\n     caveats: ${codes}`);
    if (OUT) writeFileSync(join(OUT, `${name}-${Object.values(args).join("_")}.json`), JSON.stringify(s, null, 2));
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} ${JSON.stringify(args)}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
