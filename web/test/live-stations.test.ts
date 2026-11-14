import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLiveCache } from "../api/_lib/live/core.ts";
import { METEOSTAT_STATIONS } from "../api/_lib/live/meteostat-stations.ts";
import { resolveRegion } from "../api/_lib/live/regions.ts";
import { hasMeasurement, meteostatUrl, parseMeteostat, pickStations, weatherStations } from "../api/_lib/live/stations.ts";

const CSV = [
  "year,month,day,temp,temp_source,tmin,tmin_source,tmax,tmax_source,rhum,rhum_source,prcp,prcp_source,wspd,wspd_source,pres,pres_source,cldc,cldc_source",
  "2026,11,4,19.7,metar,15.0,metar,26.0,metar,72,metar,,,7.7,metar,1009.8,metar,4,metar dwd_mosmix",
  "2026,11,5,19.3,metar dwd_mosmix,11.0,metar dwd_mosmix,27.0,metar dwd_mosmix,60,metar dwd_mosmix,0.0,dwd_mosmix,10.7,metar,1011.2,metar,0,dwd_mosmix",
  "2026,11,6,18.2,dwd_mosmix,11.0,dwd_mosmix,25.0,dwd_mosmix,68,dwd_mosmix,,,9.7,dwd_mosmix,1011.8,dwd_mosmix,6,dwd_mosmix",
].join("\n");

const fetchMock = vi.fn();
beforeEach(() => {
  clearLiveCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("Meteostat", () => {
  it("parses the daily CSV and flags model-only fields", () => {
    const days = parseMeteostat(CSV, "2026-11-04", "2026-11-06");
    expect(days.map((d) => d.date)).toEqual(["2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(days[0]).toMatchObject({ tmax_c: 26, precip_mm: null, wind_avg_kmh: 7.7 });
    expect(days[0].model_fields).toBeUndefined();
    expect(days[1].model_fields).toEqual(["precip_mm"]);
    expect(days[2].model_fields).toEqual(["tavg_c", "tmin_c", "tmax_c", "rh_pct", "wind_avg_kmh"]);
    expect(days.map(hasMeasurement)).toEqual([true, true, false]);
    expect(parseMeteostat(CSV, "2026-11-05", "2026-11-05")).toHaveLength(1);
  });

  it("only builds URLs for 5-character station ids", () => {
    expect(meteostatUrl("16622", 2026).href).toBe("https://data.meteostat.net/daily/2026/16622.csv.gz");
    expect(() => meteostatUrl("../x", 2026)).toThrow();
  });

  it("bundles stations for both countries", () => {
    expect(METEOSTAT_STATIONS.some((s) => s.country === "GR")).toBe(true);
    expect(METEOSTAT_STATIONS.some((s) => s.country === "AR")).toBe(true);
  });

  it("picks stations inside the region first", async () => {
    const el52 = await resolveRegion("EL52");
    const picked = pickStations(el52, "2026-11-01", 3, [
      { id: "16622", country: "GR", lat: 40.5167, lon: 22.9667, elev: 8, name: "Thessaloniki", obs_start: "1949-01-01", obs_end: "2026-11-09" },
      { id: "99999", country: "GR", lat: 37.9, lon: 23.7, elev: 1, name: "Athens", obs_start: null, obs_end: "2026-11-09" },
      { id: "88888", country: "GR", lat: 40.6, lon: 22.9, elev: 1, name: "Stale", obs_start: null, obs_end: "2019-01-01" },
    ]);
    expect(picked.map((p) => p.s.id)).toEqual(["16622"]);
    expect(picked[0].inside).toBe(true);
  });

  it("reports upstream_error per station without failing the call", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const r = await weatherStations(await resolveRegion("EL52"), { from: "2026-11-01", to: "2026-11-10", max_stations: 1 });
    expect(r.stations).toHaveLength(1);
    expect(r.stations[0]).toMatchObject({ id: "16622", error: "upstream_error", days_returned: 0 });
    expect(r.caveats.map((c) => c.code)).toContain("upstream_error");
  });
});
