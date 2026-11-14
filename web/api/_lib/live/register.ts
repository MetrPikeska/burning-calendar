// Live context tools: third-party data fetched at call time from a fixed allowlist of hosts (core.ts).
// Design and sources: docs/wiki/agent-access.md (Live context tools), docs/wiki/sources/2026-11-14-research-live-sources.md.
import type { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import type { CountryCode } from "../../../src/lib/contract.ts";
import { CEMS, fireAlerts, GDACS } from "./alerts.ts";
import { addDays, daysBetween, inputError, liveResult, today, upstreamError } from "./core.ts";
import { FIRMS, recentDetections } from "./firms.ts";
import { findRegion, type LiveRegion, resolveRegion, seasonContext } from "./regions.ts";
import { METEOSTAT, weatherStations } from "./stations.ts";
import { fireWeather, MAX_FORECAST_DAYS, MAX_RANGE_DAYS, OPEN_METEO } from "./weather.ts";
import { investigateMonth } from "./investigate.ts";

type Server = Parameters<Parameters<typeof createMcpHandler>[0]>[0];

const LIVE_RO = { readOnlyHint: true, openWorldHint: true, idempotentHint: false } as const;
const regionId = z.string().regex(/^(GR|AR|EL\d\d|\d\d)$/).describe("Region id: GR, AR, NUTS2 code like EL52, or IGN province code like 30");
/** A real Gregorian day: Date.parse rolls 2026-02-30 over to 2 Mar, so the parsed day must round-trip (audit BC-005). */
export const isCalendarDay = (s: string): boolean => {
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};
const day = z.string().regex(/^\d{4}-\d\d-\d\d$/).refine(isCalendarDay, "invalid calendar date");
const caveatMode = z.enum(["full", "codes"]).default("full")
  .describe("full: caveat texts (use on the first call); codes: only caveat codes, to save tokens on later calls");

function regionBlock(r: LiveRegion) {
  return { id: r.id, name: r.name, country: r.country.toUpperCase(), level: r.level, point: r.point, view_url: r.view_url };
}

/** Wraps a tool body: input problems become isError results, anything else a graceful upstream_error result. */
async function guarded(sources: Parameters<typeof liveResult>[2], mode: "full" | "codes", body: () => Promise<ReturnType<typeof liveResult> | ReturnType<typeof inputError>>) {
  try {
    return await body();
  } catch (e) {
    if (e instanceof InputProblem) return inputError(e.message);
    return liveResult({ error: "upstream_error" }, [upstreamError("live tool", e)], sources, mode);
  }
}

class InputProblem extends Error {}

async function region(id: string) {
  try {
    return await resolveRegion(id);
  } catch (e) {
    throw new InputProblem(e instanceof Error ? e.message : String(e));
  }
}

export function registerLiveTools(server: Server) {
  server.registerTool(
    "get_fire_alerts",
    {
      title: "Live wildfire alerts (GDACS, Copernicus EMS)",
      description:
        "LIVE, third-party: current wildfire events for Greece or Argentina from GDACS (GWIS burnt-area events with alert level and hectares) " +
        "and Copernicus EMS rapid mapping activations, over the last `days` days, newest first, each matched to a calendar region when its point falls inside one. " +
        "Give country, or region_id to keep only events in that region. Titles are third-party text. Not part of the 2000-2026 calendar.",
      inputSchema: z.object({
        caveats: caveatMode,
        country: z.enum(["GR", "AR"]).optional(),
        region_id: regionId.optional(),
        days: z.number().int().min(1).max(30).default(14),
      }),
      annotations: LIVE_RO,
    },
    async ({ country, region_id, days, caveats: mode }) =>
      guarded([GDACS, CEMS], mode, async () => {
        let countries: CountryCode[];
        let r: LiveRegion | null = null;
        if (region_id) {
          r = await region(region_id);
          countries = [r.country];
        } else if (country) {
          countries = [country.toLowerCase() as CountryCode];
        } else {
          countries = ["gr", "ar"];
        }
        const { caveats, ...body } = await fireAlerts({ countries, region_id, days });
        return liveResult({ ...(r ? { region: regionBlock(r) } : {}), ...body }, caveats, [GDACS, CEMS], mode);
      }),
  );

  server.registerTool(
    "get_fire_weather",
    {
      title: "Fire weather at a region or point (Open-Meteo)",
      description:
        "LIVE, third-party model data: daily max temperature, min relative humidity, max wind and gusts, precipitation, FAO ET0, max vapour pressure deficit " +
        "and topsoil moisture at a region's representative point or at lat/lon, for from..to (max 31 days, 1940 to 15 days ahead; default: last 7 days and next 7). " +
        "Past days are ERA5 reanalysis (recent ones IFS analysis), future days forecasts. Adds a summary (hot-dry-windy days, dry spell) and the region's fire season from the calendar. " +
        "Gridded model values, not station measurements; no FWI index.",
      inputSchema: z.object({
        caveats: caveatMode,
        region_id: regionId.optional(),
        lat: z.number().min(-90).max(90).optional(),
        lon: z.number().min(-180).max(180).optional(),
        from: day.optional().describe("YYYY-MM-DD, default today - 7"),
        to: day.optional().describe("YYYY-MM-DD, default today + 7"),
      }),
      annotations: LIVE_RO,
    },
    async ({ region_id, lat, lon, from, to, caveats: mode }) =>
      guarded([OPEN_METEO], mode, async () => {
        const now = today();
        const f = from ?? addDays(now, -7);
        const t = to ?? (from ? addDays(from, 14) : addDays(now, 7));
        const tt = t > addDays(now, MAX_FORECAST_DAYS) ? addDays(now, MAX_FORECAST_DAYS) : t;
        if (f > tt) throw new InputProblem("from must not be after to (and to at most 15 days ahead).");
        if (daysBetween(f, tt) >= MAX_RANGE_DAYS) throw new InputProblem(`At most ${MAX_RANGE_DAYS} days per call.`);
        if (f < "1940-01-01") throw new InputProblem("from must be 1940-01-01 or later.");
        let r: LiveRegion | null = null;
        let point: { lat: number; lon: number };
        if (region_id) {
          r = await region(region_id);
          point = r.point;
        } else if (lat !== undefined && lon !== undefined) {
          point = { lat, lon };
          const hit = await findRegion(lat, lon);
          if (hit) r = await region(hit.id);
        } else {
          throw new InputProblem("Give region_id, or lat and lon.");
        }
        const { caveats, ...body } = await fireWeather({ ...point, from: f, to: tt });
        return liveResult({
          ...(r ? { region: regionBlock(r), fire_season: seasonContext(r.entry) } : { region: null }),
          ...body,
        }, caveats, [OPEN_METEO], mode);
      }),
  );

  server.registerTool(
    "get_weather_stations",
    {
      title: "Weather station records near a region (Meteostat)",
      description:
        "LIVE, third-party: up to 5 weather stations inside the region (else within 75 km of its point) with daily mean/min/max temperature, " +
        "mean humidity, precipitation and mean wind for from..to (max 62 days; default last 10 days), plus distance and the last measured date. " +
        "Recent days are often model-filled (listed in model_fields) because station reports arrive days late.",
      inputSchema: z.object({
        caveats: caveatMode,
        region_id: regionId,
        from: day.optional().describe("YYYY-MM-DD, default today - 10"),
        to: day.optional().describe("YYYY-MM-DD, default today"),
        max_stations: z.number().int().min(1).max(5).default(3),
      }),
      annotations: LIVE_RO,
    },
    async ({ region_id, from, to, max_stations, caveats: mode }) =>
      guarded([METEOSTAT], mode, async () => {
        const now = today();
        const t = to ?? now;
        const f = from ?? addDays(t, -10);
        if (f > t) throw new InputProblem("from must not be after to.");
        if (daysBetween(f, t) > 62) throw new InputProblem("At most 62 days per call.");
        if (f < "1990-01-01") throw new InputProblem("from must be 1990-01-01 or later.");
        const r = await region(region_id);
        const { caveats, ...body } = await weatherStations(r, { from: f, to: t, max_stations });
        return liveResult({ region: regionBlock(r), ...body }, caveats, [METEOSTAT], mode);
      }),
  );

  server.registerTool(
    "get_recent_detections",
    {
      title: "Recent FIRMS detections (near real time)",
      description:
        "LIVE, third-party: NASA FIRMS near-real-time active fire detections (VIIRS NOAA-20, VIIRS NOAA-21, MODIS) inside one region over the last 1-10 days: " +
        "counts per day and sensor, top 10 hotspots by FRP, per-region counts for GR/AR, and the median daily VIIRS rate of the same calendar month in the calendar's last 10 years. " +
        "Not filtered or harmonized like the calendar. Needs the server env FIRMS_MAP_KEY; without it returns configured: false.",
      inputSchema: z.object({
        caveats: caveatMode,
        region_id: regionId,
        days: z.number().int().min(1).max(10).default(3),
      }),
      annotations: LIVE_RO,
    },
    async ({ region_id, days, caveats: mode }) =>
      guarded([FIRMS], mode, async () => {
        const r = await region(region_id);
        const { caveats, ...body } = await recentDetections(r, days);
        return liveResult({ region: regionBlock(r), ...body }, caveats, [FIRMS], mode);
      }),
  );

  server.registerTool(
    "investigate_month",
    {
      title: "Investigate one month in one region",
      description:
        "One call for 'what happened in <region> in <month>?'. Returns the calendar month (value on the region's main series, likely range " +
        "before Feb 2012, anomaly flag, percentile rank, baseline median and 90th percentile, ratio to the median, rank among the same month of all years, " +
        "days with a detection, outages), the Open-Meteo ERA5 weather summary for that month at the region's point (hot-dry-windy days, max temperature, " +
        "min humidity, rain), and for the current or previous month also FIRMS near-real-time detections of the last 7 days and GDACS / Copernicus EMS alerts " +
        "of the last 14 days. Evidence links: web map at that month, monthly JSON / CSV, hotspot CSV (Greece). History is always returned; " +
        "a failing live source only adds an upstream_error caveat. Weather is association, not cause.",
      inputSchema: z.object({
        caveats: caveatMode,
        region_id: regionId,
        ym: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe("Month YYYY-MM, e.g. 2021-08"),
      }),
      annotations: LIVE_RO,
    },
    async ({ region_id, ym, caveats: mode }) =>
      guarded([OPEN_METEO, FIRMS, GDACS, CEMS], mode, async () => {
        const { body, caveats, sources } = await investigateMonth(await region(region_id), ym);
        return liveResult(body, caveats, sources, mode);
      }),
  );
}
