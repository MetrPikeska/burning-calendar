// End-to-end through the MCP handler: the live tools are listed with openWorldHint and never turn an upstream failure into an error.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../api/mcp.ts";
import { clearLiveCache } from "../api/_lib/live/core.ts";

const fetchMock = vi.fn();
beforeEach(() => {
  clearLiveCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

let id = 0;
async function rpc(method: string, params: object) {
  const res = await POST(new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  }));
  const body = await res.text();
  const data = body.includes("data:") ? body.split("\n").filter((l) => l.startsWith("data:")).pop()!.slice(5) : body;
  return JSON.parse(data).result;
}

describe("live tools over MCP", () => {
  it("are listed read-only and open-world", async () => {
    const r = await rpc("tools/list", {});
    const live = r.tools.filter((t: { name: string }) =>
      ["get_fire_alerts", "get_fire_weather", "get_weather_stations", "get_recent_detections"].includes(t.name));
    expect(live).toHaveLength(4);
    for (const t of live) expect(t.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: true });
  });

  it("answer with upstream_error, not an error, when every upstream fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    for (const [name, args] of [
      ["get_fire_alerts", { country: "AR" }],
      ["get_fire_weather", { region_id: "30" }],
      ["get_weather_stations", { region_id: "30" }],
    ] as const) {
      const r = await rpc("tools/call", { name, arguments: args });
      expect(r.isError, name).toBeFalsy();
      expect(r.content[0].text, name).toMatch(/^CAVEAT live_upstream/);
      expect(r.structuredContent.caveats.map((c: { code: string }) => c.code), name).toContain("upstream_error");
      expect(r.structuredContent.region?.view_url ?? "https://burning-calendar.vercel.app/", name).toMatch(/^https:\/\/burning-calendar\.vercel\.app\//);
    }
  });

  it("reject bad input with isError and never fetch", async () => {
    const r = await rpc("tools/call", { name: "get_fire_weather", arguments: {} });
    expect(r.isError).toBe(true);
    const unknown = await rpc("tools/call", { name: "get_recent_detections", arguments: { region_id: "EL99" } });
    expect(unknown.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reject region_id together with lat/lon in get_fire_weather (audit P2-01)", async () => {
    const r = await rpc("tools/call", { name: "get_fire_weather", arguments: { region_id: "EL64", lat: 0, lon: 0 } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/not both/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reject a region of the other country in get_fire_alerts (audit R2-003)", async () => {
    const r = await rpc("tools/call", { name: "get_fire_alerts", arguments: { country: "AR", region_id: "EL52" } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/EL52 belongs to GR, not AR/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reject days that do not exist instead of calling the upstream (audit BC-005)", async () => {
    for (const from of ["2026-02-30", "2025-02-29", "2026-04-31"]) {
      const r = await rpc("tools/call", { name: "get_fire_weather", arguments: { region_id: "EL52", from, to: "2026-05-01" } });
      expect(r.isError, from).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    const { isCalendarDay } = await import("../api/_lib/live/register.ts");
    expect(isCalendarDay("2024-02-29")).toBe(true);
    expect(isCalendarDay("2026-02-30")).toBe(false);
  });
});

describe("live caveat codes", () => {
  it("are all explained by get_methodology topic caveats", async () => {
    const { METHODOLOGY } = await import("../api/_lib/tools.ts");
    const { readFileSync, readdirSync } = await import("node:fs");
    const src = readdirSync("api/_lib/live").map((f) => readFileSync(`api/_lib/live/${f}`, "utf8")).join("\n");
    const codes = [...new Set([...src.matchAll(/code: "([a-z_]+)"/g)].map((m) => m[1]))];
    expect(codes.length).toBeGreaterThan(5);
    for (const c of codes) expect(METHODOLOGY.caveats, c).toMatch(new RegExp(`\\b${c} =`));
  });
});
