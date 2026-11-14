// investigate_month: history always comes back; weather and the live picture are optional extras.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../api/mcp.ts";
import { clearLiveCache } from "../api/_lib/live/core.ts";
import { investigateMonth, isRecent, weatherWindow } from "../api/_lib/live/investigate.ts";
import { resolveRegion } from "../api/_lib/live/regions.ts";

const om = {
  latitude: 38.77, longitude: 23.33, elevation: 136, timezone: "Europe/Athens",
  daily: {
    time: ["2021-08-01", "2021-08-02", "2021-08-03"],
    temperature_2m_max: [36.1, 40.9, 40.6],
    relative_humidity_2m_min: [28, 18, 20],
    wind_speed_10m_max: [12.3, 7.1, 23.4],
    wind_gusts_10m_max: [30.6, 21.6, 40],
    precipitation_sum: [3.0, 0, 0],
    et0_fao_evapotranspiration: [6.72, 6.23, 7],
    vapour_pressure_deficit_max: [4.2, 6.34, 5],
    soil_moisture_0_to_7cm_mean: [0.1123, null, 0.11],
  },
};

const fetchMock = vi.fn();
beforeEach(() => {
  clearLiveCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const codes = (cs: { code: string }[]) => cs.map((c) => c.code);

describe("investigate_month helpers", () => {
  it("treats the current and the previous month as recent", () => {
    expect(isRecent("2026-11", "2026-11-14")).toBe(true);
    expect(isRecent("2026-10", "2026-11-14")).toBe(true);
    expect(isRecent("2026-09", "2026-11-14")).toBe(false);
    expect(isRecent("2026-12", "2026-11-14")).toBe(false);
    expect(isRecent("2025-12", "2026-01-03")).toBe(true);
  });

  it("asks for weather over the whole month, clipped to today, and none for the future or before 1940", () => {
    expect(weatherWindow("2021-08", "2026-11-14")).toEqual({ from: "2021-08-01", to: "2021-08-31" });
    expect(weatherWindow("2024-02", "2026-11-14")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(weatherWindow("2026-11", "2026-11-14")).toEqual({ from: "2026-11-01", to: "2026-11-14" });
    expect(weatherWindow("2026-12", "2026-11-14")).toBeNull();
    expect(weatherWindow("1939-12", "2026-11-14")).toBeNull();
  });
});

describe("investigateMonth", () => {
  it("puts Evia Aug 2021 next to its weather (EL64: 4235, median 63.1)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(om), { status: 200 }));
    const { body, caveats, sources } = await investigateMonth(await resolveRegion("EL64"), "2021-08", {});
    const h = body.history;
    if (!h.found) throw new Error("month not found");
    expect(h.month).toMatchObject({ value: 4235, src: "observed", anom: true, baseline_median: 63.1, rank_among_years: 1, baseline_kind: "retrospective" });
    expect(h.month.ratio_to_median).toBeGreaterThan(60);
    expect(h.units.value).toMatch(/VIIRS-equivalent/);
    expect(h.units.anom_pct).toMatch(/not a percent change/);
    expect(body.weather).toMatchObject({ window: { from: "2021-08-01", to: "2021-08-31" }, summary: { tmax_c_max: 40.9 } });
    expect(body.now).toMatchObject({ skipped: expect.stringMatching(/not the current or previous month/) });
    expect(body.evidence.map).toContain("region=EL64");
    expect(body.evidence.detections_csv).toMatch(/gr\/detections\/EL64\.csv$/);
    expect(codes(caveats)).toContain("association_not_cause");
    expect(codes(caveats)).not.toContain("upstream_error");
    expect(sources.map((s) => s.name)).toEqual([expect.stringMatching(/Open-Meteo/)]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the weather archive, no FIRMS or alerts for an old month
  });

  it("still returns the history when the weather service fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { body, caveats } = await investigateMonth(await resolveRegion("30"), "2020-08", {});
    if (!body.history.found) throw new Error("month not found");
    expect(body.history.month.value).toBe(16492);
    expect(codes(caveats)).toContain("upstream_error");
  });

  it("says when the month is outside the calendar", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(om), { status: 200 }));
    const { body, caveats } = await investigateMonth(await resolveRegion("EL52"), "1999-07", {});
    expect(body.history.found).toBe(false);
    expect(codes(caveats)).toContain("out_of_coverage");
  });

  it("adds the live picture for the current month, also without a FIRMS key", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { body, caveats } = await investigateMonth(await resolveRegion("EL52"), "2026-11", {});
    expect(body.history.found).toBe(false); // the calendar ends Oct 2026
    expect(body.now).toMatchObject({ recent_detections: { configured: false } });
    expect(codes(caveats)).toEqual(expect.arrayContaining(["out_of_coverage", "not_configured", "upstream_error"]));
  });
});

describe("investigate_month over MCP", () => {
  let id = 0;
  async function call(args: object) {
    const res = await POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name: "investigate_month", arguments: args } }),
    }));
    const text = await res.text();
    const data = text.includes("data:") ? text.split("\n").filter((l) => l.startsWith("data:")).pop()!.slice(5) : text;
    return JSON.parse(data).result;
  }

  it("never errors on upstream failure and rejects bad input", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const r = await call({ region_id: "EL64", ym: "2021-08" });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.history.month.value).toBe(4235);
    expect(r.content[0].text).toMatch(/^CAVEAT live_upstream/);
    const bad = await call({ region_id: "EL99", ym: "2021-08" });
    expect(bad.isError).toBe(true);
    const badYm = await call({ region_id: "EL64", ym: "2021-13" });
    expect(badYm.isError).toBe(true);
  });
});
