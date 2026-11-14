import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLiveCache } from "../api/_lib/live/core.ts";
import { chunks, firmsKey, firmsUrl, monthBaseline, parseFirmsCsv, recentDetections } from "../api/_lib/live/firms.ts";
import { resolveRegion } from "../api/_lib/live/regions.ts";

type Configured = Extract<Awaited<ReturnType<typeof recentDetections>>, { calendar_context: unknown }>;

const KEY = "0123456789abcdef0123456789abcdef";
const VIIRS = [
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight",
  "38.50,23.70,330.1,0.4,0.4,2026-11-13,1042,N20,VIIRS,n,2.0NRT,290.1,12.5,D",
  "38.51,23.71,335.1,0.4,0.4,2026-11-14,0005,N20,VIIRS,h,2.0NRT,290.1,40.0,N",
  "37.98,23.73,331.0,0.4,0.4,2026-11-14,1042,N20,VIIRS,n,2.0NRT,290.1,99.0,D",
].join("\n");
const MODIS = [
  "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight",
  "38.52,23.69,320.0,1.0,1.0,2026-11-13,0930,Terra,MODIS,77,6.1NRT,295.0,20.0,D",
].join("\n");

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

describe("FIRMS helpers", () => {
  it("reads the key from env only and rejects malformed values", () => {
    expect(firmsKey({})).toBeNull();
    expect(firmsKey({ FIRMS_MAP_KEY: "x/../y" })).toBeNull();
    expect(firmsKey({ FIRMS_MAP_KEY: ` ${KEY} ` })).toBe(KEY);
  });

  it("builds area API URLs and splits windows into 5-day calls", () => {
    expect(firmsUrl(KEY, "VIIRS_NOAA20_NRT", [23.123, 38.001, 24.5, 39.2], 3).href)
      .toBe(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/VIIRS_NOAA20_NRT/23.12,38,24.5,39.2/3`);
    expect(chunks(3, "2026-11-14")).toEqual([{ days: 3 }]);
    expect(chunks(10, "2026-11-14")).toEqual([{ days: 5 }, { days: 5, date: "2026-11-05" }]);
    expect(chunks(7, "2026-11-14")).toEqual([{ days: 5 }, { days: 2, date: "2026-11-08" }]);
  });

  it("parses VIIRS and MODIS CSVs and rejects non-CSV answers", () => {
    const v = parseFirmsCsv(VIIRS, "VIIRS_NOAA20_NRT");
    expect(v).toHaveLength(3);
    expect(v[1]).toMatchObject({ date: "2026-11-14", time_utc: "00:05", sensor: "viirs_noaa20", frp_mw: 40, confidence: "h", daynight: "N" });
    expect(parseFirmsCsv(MODIS, "MODIS_NRT")[0]).toMatchObject({ sensor: "modis", confidence: "77" });
    expect(() => parseFirmsCsv("Invalid MAP_KEY.", "MODIS_NRT")).toThrow(/not a FIRMS CSV/);
  });

  it("computes the median of the same calendar month over the last 10 years", () => {
    const months = Array.from({ length: 12 }, (_, i) => ({ ym: `${2014 + i}-11`, viirs: i }));
    expect(monthBaseline(months, 11)).toEqual({ month: 11, years: "2016-2025", median_month_total: 6.5, median_per_day: 0.22 });
    expect(monthBaseline([], 11)).toBeNull();
  });
});

describe("recentDetections", () => {
  it("returns not_configured without calling FIRMS when the key is missing", async () => {
    const r = await recentDetections(await resolveRegion("EL64"), 3, {});
    expect(r.configured).toBe(false);
    expect(r.caveats[0].code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts detections inside the region per day and sensor, with the calendar baseline", async () => {
    fetchMock.mockImplementation(async (u: URL) => {
      const body = u.pathname.includes("/MODIS_NRT/") ? MODIS : u.pathname.includes("/VIIRS_NOAA20_NRT/") ? VIIRS : VIIRS.split("\n")[0];
      return new Response(body, { status: 200 });
    });
    const r = (await recentDetections(await resolveRegion("EL64"), 2, { FIRMS_MAP_KEY: KEY })) as Configured;
    expect(r.configured).toBe(true);
    expect(r.totals).toEqual({ viirs_noaa20: 2, viirs_noaa21: 0, modis: 1 }); // the Athens point (EL30) is left out
    expect(r.counts_by_day).toEqual([
      { date: "2026-11-13", viirs_noaa20: 1, viirs_noaa21: 0, modis: 1 },
      { date: "2026-11-14", viirs_noaa20: 1, viirs_noaa21: 0, modis: 0 },
    ]);
    expect(r.top_hotspots[0]).toMatchObject({ frp_mw: 40, region_id: "EL64" });
    expect(r.calendar_context).toMatchObject({
      month: 11, full_days: 1, nrt_viirs_noaa20_per_day: 1, median_month_total: 36.5,
      per_sensor_per_day: { viirs_noaa20: 1, viirs_noaa21: 0, modis: 1 },
      ratio_to_median_per_day: 0.82, // 1 per day against 36.5 / 30
    });
    expect(r.calendar_context!.comparison.ratio_uses).toMatch(/NOAA-20 against S-NPP only/);
  });

  const failNoaa20 = async (u: URL) =>
    u.pathname.includes("/VIIRS_NOAA20_NRT/") ? new Response("busy", { status: 503 })
      : new Response(u.pathname.includes("/MODIS_NRT/") ? MODIS : VIIRS.split("\n")[0], { status: 200 });

  it("gives a null rate and ratio, not 0, when the NOAA-20 source fails", async () => {
    fetchMock.mockImplementation(failNoaa20);
    const r = (await recentDetections(await resolveRegion("EL64"), 2, { FIRMS_MAP_KEY: KEY })) as Configured;
    expect(r.sources_failed).toEqual(["VIIRS_NOAA20_NRT"]);
    expect(r.calendar_context).toMatchObject({
      nrt_viirs_noaa20_per_day: null, ratio_to_median_per_day: null,
      per_sensor_per_day: { viirs_noaa20: null, viirs_noaa21: 0, modis: 1 },
    });
    expect(r.caveats.find((c) => c.code === "ratio_unavailable")?.message).toMatch(/NOAA-20 NRT source failed/);
  });

  it("gives no ratio for a one-day window, since today is incomplete", async () => {
    fetchMock.mockImplementation(async (u: URL) => new Response(u.pathname.includes("/VIIRS_NOAA20_NRT/") ? VIIRS : VIIRS.split("\n")[0], { status: 200 }));
    const r = (await recentDetections(await resolveRegion("EL64"), 1, { FIRMS_MAP_KEY: KEY })) as Configured;
    expect(r.totals.viirs_noaa20).toBe(1);
    expect(r.calendar_context).toMatchObject({ full_days: 0, nrt_viirs_noaa20_per_day: null, ratio_to_median_per_day: null });
    expect(r.caveats.find((c) => c.code === "ratio_unavailable")?.message).toMatch(/no full day/);
  });

  it("drops the ratio on a baseline month under 20 detections (EL30 November median 6.5)", async () => {
    fetchMock.mockImplementation(async (u: URL) => new Response(u.pathname.includes("/VIIRS_NOAA20_NRT/") ? VIIRS : VIIRS.split("\n")[0], { status: 200 }));
    const r = (await recentDetections(await resolveRegion("EL30"), 2, { FIRMS_MAP_KEY: KEY })) as Configured;
    expect(r.calendar_context).toMatchObject({ median_month_total: 6.5, nrt_viirs_noaa20_per_day: 0, ratio_to_median_per_day: null });
    expect(r.caveats.map((c) => c.code)).toContain("low_baseline");
    expect(r.caveats.map((c) => c.code)).not.toContain("ratio_unavailable");
  });

  it("masks the key in upstream errors", async () => {
    fetchMock.mockResolvedValue(new Response(`Invalid MAP_KEY ${KEY}.`, { status: 400 }));
    const r = (await recentDetections(await resolveRegion("EL64"), 1, { FIRMS_MAP_KEY: KEY })) as Configured;
    expect(JSON.stringify(r)).not.toContain(KEY);
    expect(r.caveats.map((c) => c.code)).toContain("upstream_error");
    expect(r.sources_failed).toEqual(["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]);
  });
});
