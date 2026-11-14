// End-to-end tests of api/mcp.ts: the exported handler called with web Requests (no server, no network).
// Covers the show_calendar widget, the Origin check and both protocol eras (2025 stateless, 2026-07-28).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POST } from "../api/mcp.ts";
import { allowedOriginHosts, originEnforced, withOriginCheck } from "../api/_lib/origin.ts";
import { CALENDAR_HTML } from "../api/_lib/widget-html.ts";
import { CALENDAR_URI, calendarData, RESOURCE_MIME_TYPE, safeText, withoutCells } from "../api/_lib/widget.ts";
import type { IndexFile, RegionFile } from "../src/lib/contract.ts";

const read = <T>(p: string) => JSON.parse(readFileSync(`public/data/v1/${p}`, "utf8")) as T;
const period = read<IndexFile>("gr/index.json").period;

const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "vitest", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

let nextId = 0;
type Rpc = { status: number; body: { result?: any; error?: { code: number; message: string } } };

async function rpc(method: string, params?: object, opts: { modern?: boolean; origin?: string } = {}): Promise<Rpc> {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (opts.origin) headers.origin = opts.origin;
  let p = params;
  if (opts.modern) {
    headers["mcp-protocol-version"] = "2026-07-28";
    headers["mcp-method"] = method;
    const name = (params as { name?: string; uri?: string } | undefined)?.name ?? (params as { uri?: string } | undefined)?.uri;
    if (name) headers["mcp-name"] = name;
    p = { ...params, _meta: MODERN_META };
  } else {
    headers["mcp-protocol-version"] = "2025-06-18";
  }
  const res = await POST(new Request("http://localhost/api/mcp", {
    method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method, ...(p ? { params: p } : {}) }),
  }));
  const text = await res.text();
  const data = text.includes("data:") ? text.split("\n").filter((l) => l.startsWith("data:")).pop()!.slice(5) : text;
  return { status: res.status, body: JSON.parse(data) };
}

describe("show_calendar data", () => {
  const el64 = read<RegionFile>("gr/regions/EL64.json");
  const el62 = read<RegionFile>("gr/regions/EL62.json"); // relative

  it("covers the whole period by default with harm and back-cast ranges", () => {
    const d = calendarData(el64, {}, period);
    expect(d.series).toBe("harm");
    expect(d.months[0].ym).toBe(period.start);
    expect(d.months.at(-1)!.ym).toBe(period.end);
    const aug21 = d.months.find((m) => m.ym === "2021-08")!;
    expect(aug21.anom).toBe(true);
    expect(d.anomaly_months).toContain("2021-08");
    const back = d.months.find((m) => m.ym === "2007-08")!;
    expect(back.src).not.toBe("observed");
    expect(back.lo).toBeLessThanOrEqual(back.v!);
    expect(d.caveats.map((c) => c.code)).toEqual(expect.arrayContaining(["backcast", "detections_not_fires"]));
    expect(d.view_url).toBe("https://burning-calendar.vercel.app/?country=gr&region=EL64");
  });

  it("uses MODIS for relative regions and refuses harm", () => {
    const d = calendarData(el62, { from: "2019-01", to: "2020-12" }, period);
    expect(d.series).toBe("modis");
    expect(d.months).toHaveLength(24);
    expect(d.months.every((m) => !("lo" in m))).toBe(true);
    expect(d.view_url).toContain("from=2019-01&to=2020-12&series=modis");
    expect(() => calendarData(el62, { series: "harm" }, period)).toThrow(/relative mode/);
  });

  it("drops harm anomaly flags and switches the unit when a harmonized region is shown as MODIS (audit BC-001)", () => {
    const el52 = read<RegionFile>("gr/regions/EL52.json");
    const own = calendarData(el52, { from: "2024-01", to: "2024-12" }, period);
    expect(own.anomaly_months).toContain("2024-05");
    const d = calendarData(el52, { from: "2024-01", to: "2024-12", series: "modis" }, period);
    expect(d.unit).toMatch(/raw MODIS/);
    expect(d.months.some((m) => "anom" in m)).toBe(false);
    expect(d.anomaly_months).toBeUndefined();
    expect(d.anomaly_months_omitted).toMatch(/harm series/);
    // R2-001: no anomaly months at any level, no harm-only caveats on MODIS values.
    expect(JSON.stringify(d)).not.toMatch(/"anomaly_months"/);
    const codes = d.caveats.map((c) => c.code);
    expect(codes).not.toContain("small_counts");
    expect(codes).not.toContain("backcast");
    expect(d.caveats.find((c) => c.code === "outage")?.message ?? "").not.toMatch(/VIIRS/);
    expect(own.totals[0].anomaly_months).toEqual(["2024-05", "2024-06", "2024-07", "2024-08"]);
    expect(own.caveats.map((c) => c.code)).toContain("small_counts");
    const v = calendarData(el52, { from: "2024-01", to: "2024-12", series: "viirs" }, period);
    expect(JSON.stringify(v)).not.toMatch(/"anomaly_months"|"anom"/);
  });

  it("VIIRS before 2012: no value, a series caveat, totals of the shown series only (audit BC3-005)", () => {
    const v = calendarData(el64, { from: "2003-01", to: "2003-02", series: "viirs" }, period);
    expect(v.months.every((m) => m.v === null && m.src === "no_data")).toBe(true);
    expect(v.totals).toEqual([{ year: 2003, series: "viirs", n_months: 2, partial: true, n_values: 0, total: null }]);
    expect(v.backcast_months).toBe(0);
    expect(v.caveats.find((c) => c.code === "series_not_available")?.message).toMatch(/20 Jan 2012/);
    for (const [from, to, series] of [["2011-11", "2012-03", "viirs"], ["2003-01", "2003-02", "modis"], ["2012-01", "2012-02", "harm"]] as const) {
      const d = calendarData(el64, { from, to, series }, period);
      for (const t of d.totals) {
        const cells = d.months.filter((m) => m.ym.startsWith(String(t.year)));
        const vals = cells.map((m) => m.v).filter((x): x is number => x !== null);
        expect(t.n_values).toBe(vals.length);
        if (vals.length) expect(t.total).toBeCloseTo(vals.reduce((a, b) => a + b, 0), 0);
        expect(Object.keys(t)).not.toContain("modis" === series ? "harm" : "modis");
      }
      if (series !== "viirs") expect(d.caveats.map((c) => c.code)).not.toContain("series_not_available");
      if (series === "harm") expect(d.backcast_months).toBe(d.months.filter((m) => m.src !== "observed").length);
    }
  });

  it("strips control, bidi and zero-width characters from names", () => {
    expect(safeText("Ke\u0000ntr‮iki​ Ellada\u0085", 80)).toBe("Kentriki Ellada");
    expect(safeText("x".repeat(200))).toHaveLength(80);
  });

  it("drops the cells from the text block only", () => {
    const sc = { months: [{ ym: "2020-01" }], view_url: "u" };
    const r = withoutCells({ content: [{ type: "text" as const, text: `CAVEAT a: b\n${JSON.stringify(sc)}` }], structuredContent: sc });
    expect(r.content[0].text.startsWith("CAVEAT a: b\n")).toBe(true);
    const body = JSON.parse(r.content[0].text.split("\n")[1]);
    expect(body.months).toBeUndefined();
    expect(body.months_in_widget).toBe(1);
    expect(r.structuredContent.months).toHaveLength(1);
  });
});

describe("widget HTML", () => {
  it("is self-contained: no external scripts, styles, images or fetches", () => {
    expect(CALENDAR_HTML.startsWith("<!doctype html>")).toBe(true);
    expect(CALENDAR_HTML).not.toMatch(/<script[^>]+src=|<link[^>]+href=|<img|@import|fetch\(|XMLHttpRequest|WebSocket/i);
    // The only absolute URLs are the SVG namespace and our own deep-link base.
    const urls = [...CALENDAR_HTML.matchAll(/https?:\/\/[^"'\s)]+/g)].map((m) => m[0]);
    expect(new Set(urls)).toEqual(new Set(["https://burning-calendar.vercel.app/", "http://www.w3.org/2000/svg"]));
    expect(CALENDAR_HTML).toContain("ui/initialize");
    expect(CALENDAR_HTML).toContain("ui/notifications/tool-result");
  });
});

describe("MCP endpoint, 2025 stateless clients", () => {
  it("initialize still works", async () => {
    const r = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } });
    expect(r.status).toBe(200);
    expect(r.body.result.protocolVersion).toBe("2025-06-18");
    expect(r.body.result.capabilities.resources).toBeDefined();
  });

  it("lists show_calendar with _meta.ui.resourceUri", async () => {
    const r = await rpc("tools/list");
    const tool = r.body.result.tools.find((t: { name: string }) => t.name === "show_calendar");
    expect(tool._meta.ui.resourceUri).toBe(CALENDAR_URI);
    expect(tool._meta["ui/resourceUri"]).toBe(CALENDAR_URI);
    expect(tool.annotations.readOnlyHint).toBe(true);
    expect(r.body.result.tools).toHaveLength(16);
  });

  it("serves the units methodology topic and names units in the caveats topic", async () => {
    const u = await rpc("tools/call", { name: "get_methodology", arguments: { topic: "units" } });
    expect(u.body.result.isError).toBeFalsy();
    expect(u.body.result.content[0].text).toMatch(/percentile rank 0-100, not a percent change/);
    const c = await rpc("tools/call", { name: "get_methodology", arguments: { topic: "caveats" } });
    expect(c.body.result.content[0].text).toMatch(/Units: every answer with numbers carries units/);
  });

  it("lists and reads the ui:// resource", async () => {
    const list = await rpc("resources/list");
    expect(list.body.result.resources).toEqual([expect.objectContaining({ uri: CALENDAR_URI, mimeType: RESOURCE_MIME_TYPE })]);
    const r = await rpc("resources/read", { uri: CALENDAR_URI });
    const c = r.body.result.contents[0];
    expect(c.mimeType).toBe("text/html;profile=mcp-app");
    expect(c.text).toBe(CALENDAR_HTML);
    expect(c._meta.ui.prefersBorder).toBe(true);
  });

  it("show_calendar returns caveats first, structuredContent with cells, text without cells", async () => {
    const r = await rpc("tools/call", { name: "show_calendar", arguments: { region_id: "EL64", from: "2021-01", to: "2021-12" } });
    const res = r.body.result;
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text.startsWith("CAVEAT ")).toBe(true);
    expect(res.content[0].text).not.toContain('"months":[');
    expect(res.content[0].text).toContain("months_in_widget");
    const s = res.structuredContent;
    expect(s.months).toHaveLength(12);
    expect(s.coverage.start).toBe("2000-11");
    expect(s.source.method_version).toBeTruthy();
    expect(s.view_url).toContain("region=EL64&from=2021-01&to=2021-12");
  });

  it("show_calendar reports bad input as a tool error", async () => {
    const r = await rpc("tools/call", { name: "show_calendar", arguments: { region_id: "EL62", series: "harm" } });
    expect(r.body.result.isError).toBe(true);
  });
});

describe("MCP endpoint, 2026-07-28 clients", () => {
  it("server/discover lists 2026-07-28", async () => {
    const r = await rpc("server/discover", undefined, { modern: true });
    expect(r.status).toBe(200);
    expect(r.body.result.supportedVersions).toContain("2026-07-28");
    expect(r.body.result.capabilities.tools).toBeDefined();
  });

  it("tools/call with the _meta envelope and standard headers works", async () => {
    const r = await rpc("tools/call", { name: "show_calendar", arguments: { region_id: "30", from: "2020-01", to: "2020-12", caveats: "codes" } }, { modern: true });
    expect(r.status).toBe(200);
    expect(r.body.result.structuredContent.months).toHaveLength(12);
    expect(r.body.result.structuredContent.caveat_codes).toContain("coverage");
  });

  it("resources/read works", async () => {
    const r = await rpc("resources/read", { uri: CALENDAR_URI }, { modern: true });
    expect(r.status).toBe(200);
    expect(r.body.result.contents[0].mimeType).toBe(RESOURCE_MIME_TYPE);
  });
});

describe("Origin check", () => {
  const ok = async () => new Response("ok", { status: 200 });
  const req = (origin: string) => new Request("http://localhost/api/mcp", { method: "POST", headers: { origin } });
  const enforced = withOriginCheck(ok, allowedOriginHosts(""), true);

  it("enforced: rejects a foreign Origin with 403", async () => {
    const r = await enforced(req("https://evil.example"));
    expect(r.status).toBe(403);
    expect((await r.json()).error?.code).toBe(-32000);
  });

  it("enforced: rejects the opaque null Origin", async () => {
    expect((await enforced(req("null"))).status).toBe(403);
  });

  it.each(["https://burning-calendar.vercel.app", "http://localhost:6274", "https://claude.ai", "https://chatgpt.com"])(
    "enforced: accepts %s", async (origin) => {
      expect((await enforced(req(origin))).status).toBe(200);
    });

  it("report-only by default: the endpoint serves a foreign Origin", async () => {
    expect(originEnforced(undefined)).toBe(false);
    expect(originEnforced("1")).toBe(true);
    expect((await rpc("tools/list", undefined, { origin: "https://evil.example" })).status).toBe(200);
  });

  it("reads extra hosts from MCP_ALLOWED_ORIGINS", () => {
    expect(allowedOriginHosts(" Preview.Example.app , ,x.dev")).toEqual(expect.arrayContaining(["preview.example.app", "x.dev"]));
  });
});
