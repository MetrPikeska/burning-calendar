import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLiveCache } from "../api/_lib/live/core.ts";
import { fireWeather, openMeteoUrl, parseOpenMeteo, planRequests, summarize } from "../api/_lib/live/weather.ts";

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
});
afterEach(() => vi.unstubAllGlobals());

describe("Open-Meteo", () => {
  it("splits a window into archive (up to today) and forecast (after today)", () => {
    expect(planRequests("2026-11-07", "2026-11-21", "2026-11-14")).toEqual([
      { kind: "archive", from: "2026-11-07", to: "2026-11-14" },
      { kind: "forecast", from: "2026-11-15", to: "2026-11-21" },
    ]);
    expect(planRequests("2021-08-01", "2021-08-10", "2026-11-14")).toEqual([{ kind: "archive", from: "2021-08-01", to: "2021-08-10" }]);
    expect(planRequests("2026-11-16", "2026-11-18", "2026-11-14")).toEqual([{ kind: "forecast", from: "2026-11-16", to: "2026-11-18" }]);
  });

  it("builds URLs only on the two Open-Meteo hosts", () => {
    expect(openMeteoUrl("archive", 38.8, 23.4, "2021-08-01", "2021-08-02").hostname).toBe("archive-api.open-meteo.com");
    const f = openMeteoUrl("forecast", -32.9, -59.9, "2026-11-15", "2026-11-20");
    expect(f.hostname).toBe("api.open-meteo.com");
    expect(f.searchParams.get("daily")).toContain("vapour_pressure_deficit_max");
  });

  it("parses daily arrays into rows with short keys", () => {
    const { days, grid } = parseOpenMeteo(om, "reanalysis");
    expect(days).toHaveLength(3);
    expect(days[1]).toMatchObject({ date: "2021-08-02", kind: "reanalysis", tmax_c: 40.9, rh_min_pct: 18, soil_moisture_0_7cm_m3m3: null });
    expect(days[0].soil_moisture_0_7cm_m3m3).toBe(0.112);
    expect(grid).toMatchObject({ lat: 38.77, elevation_m: 136, timezone: "Europe/Athens" });
    expect(parseOpenMeteo({}, "forecast").days).toEqual([]);
  });

  it("summarizes the window", () => {
    const s = summarize(parseOpenMeteo(om, "reanalysis").days);
    expect(s).toMatchObject({ tmax_c_max: 40.9, rh_min_pct_min: 18, precip_mm_total: 3, days_hot_dry_windy: 1, dry_days_at_end_of_past: 2 });
  });

  it("returns an empty result with upstream_error when Open-Meteo is down", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }));
    const r = await fireWeather({ lat: 38.8, lon: 23.4, from: "2021-08-01", to: "2021-08-03" });
    expect(r.days).toEqual([]);
    expect(r.caveats.map((c) => c.code)).toContain("upstream_error");
    expect(r.caveats.find((c) => c.code === "upstream_error")!.message).toMatch(/HTTP 503/);
  });
});
