#!/usr/bin/env node
// Smoke test of a deployed MCP endpoint and the static agent layer.
// Usage: node scripts/smoke-mcp.mjs [base-url] [--no-static]   (default: production)
// --no-static skips llms.txt and /data (for a local server that serves only the function).
// Calls every tool once over Streamable HTTP (2025-06-18 era, stateless), checks key fields
// and known values, prints one line per check, exits 1 on any failure.

const args = process.argv.slice(2);
const STATIC = !args.includes("--no-static");
const BASE = (args.find((a) => !a.startsWith("--")) ?? "https://burning-calendar.vercel.app").replace(/\/$/, "");
const MCP = `${BASE}/api/mcp`;
const TOOLS = [
  "search_regions", "get_region_series", "get_season_calendar", "get_anomalies", "compare_regions",
  "aggregate", "rank_regions", "find_region_at", "get_validation", "get_methodology",
];

let id = 0;
async function rpc(method, params) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
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
    must(JSON.stringify(names) === JSON.stringify([...TOOLS].sort()), `tools: ${names.join(",")}`);
    must(r.tools.every((t) => t.annotations?.readOnlyHint === true), "a tool lacks readOnlyHint");
    return `${names.length} tools, all readOnlyHint`;
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
const staticChecks = [
  ["static: llms.txt", async () => {
    const res = await fetch(`${BASE}/llms.txt`);
    must(res.ok && (await res.text()).startsWith("# "), `llms.txt HTTP ${res.status}`);
    return "ok";
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
console.log(`smoke ${BASE}`);
if (STATIC) checks.push(...staticChecks);
for (const [name, fn] of checks) {
  const t0 = performance.now();
  try {
    const info = await fn();
    console.log(`ok   ${name.padEnd(20)} ${String(Math.round(performance.now() - t0)).padStart(5)} ms  ${info}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name.padEnd(20)} ${String(Math.round(performance.now() - t0)).padStart(5)} ms  ${e.message}`);
  }
}
console.log(failed ? `${failed} of ${checks.length} checks failed` : `all ${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
