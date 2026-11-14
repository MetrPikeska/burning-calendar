// get_fire_weather: daily fire-relevant weather at a point from Open-Meteo (reanalysis archive and forecast).
import { addDays, daysBetween, fetchUpstream, type LiveCaveat, round, type SourceInfo, today, upstreamError } from "./core.ts";

export const OPEN_METEO: SourceInfo = {
  name: "Open-Meteo (Historical Weather API: ERA5, ERA5-Land and ECMWF IFS analysis; Forecast API: best-match weather models)",
  url: "https://open-meteo.com/",
  licence: "CC BY 4.0; free non-commercial use under 10,000 calls per day, 5,000 per hour, 600 per minute, no key (open-meteo.com/en/terms).",
  attribution: "Weather data by Open-Meteo.com (CC BY 4.0), based on Copernicus ERA5 / ECMWF and national weather service models",
};

export const DAILY_VARS = [
  "temperature_2m_max",
  "relative_humidity_2m_min",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "precipitation_sum",
  "et0_fao_evapotranspiration",
  "vapour_pressure_deficit_max",
  "soil_moisture_0_to_7cm_mean",
] as const;

/** Short output keys, units in the key or in `units`. */
const OUT_KEY: Record<(typeof DAILY_VARS)[number], string> = {
  temperature_2m_max: "tmax_c",
  relative_humidity_2m_min: "rh_min_pct",
  wind_speed_10m_max: "wind_max_kmh",
  wind_gusts_10m_max: "gust_max_kmh",
  precipitation_sum: "precip_mm",
  et0_fao_evapotranspiration: "et0_mm",
  vapour_pressure_deficit_max: "vpd_max_kpa",
  soil_moisture_0_to_7cm_mean: "soil_moisture_0_7cm_m3m3",
};

export const MAX_FORECAST_DAYS = 15;
export const MAX_RANGE_DAYS = 31;
const TTL_ARCHIVE = 6 * 3600_000;
const TTL_FORECAST = 30 * 60_000;

export function openMeteoUrl(kind: "archive" | "forecast", lat: number, lon: number, from: string, to: string): URL {
  const u = new URL(kind === "archive" ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", lat.toFixed(4));
  u.searchParams.set("longitude", lon.toFixed(4));
  u.searchParams.set("start_date", from);
  u.searchParams.set("end_date", to);
  u.searchParams.set("daily", DAILY_VARS.join(","));
  u.searchParams.set("timezone", "auto");
  return u;
}

export interface WeatherDay {
  date: string;
  kind: "reanalysis" | "forecast";
  [k: string]: string | number | null;
}

type OmDaily = { daily?: Record<string, (number | null)[] | string[]> & { time?: string[] }; latitude?: number; longitude?: number; elevation?: number; timezone?: string };

export function parseOpenMeteo(json: unknown, kind: WeatherDay["kind"]): { days: WeatherDay[]; grid: { lat: number | null; lon: number | null; elevation_m: number | null; timezone: string | null } } {
  const j = (json ?? {}) as OmDaily;
  const d = j.daily ?? {};
  const time = (d.time ?? []) as string[];
  const days = time.filter((t) => /^\d{4}-\d\d-\d\d$/.test(t)).map((t, i) => {
    const row: WeatherDay = { date: t, kind };
    for (const v of DAILY_VARS) {
      const arr = d[v] as (number | null)[] | undefined;
      const x = arr?.[i];
      row[OUT_KEY[v]] = typeof x === "number" ? round(x, v === "soil_moisture_0_to_7cm_mean" ? 3 : 1) : null;
    }
    return row;
  });
  return {
    days,
    grid: {
      lat: round(j.latitude ?? null, 3), lon: round(j.longitude ?? null, 3),
      elevation_m: round(j.elevation ?? null, 0), timezone: typeof j.timezone === "string" ? j.timezone.slice(0, 40) : null,
    },
  };
}

/** Plain summary of the window: no index, just the numbers an analyst looks at first. */
export function summarize(days: WeatherDay[]) {
  const vals = (k: string) => days.map((d) => d[k]).filter((x): x is number => typeof x === "number");
  const max = (k: string) => (vals(k).length ? Math.max(...vals(k)) : null);
  const min = (k: string) => (vals(k).length ? Math.min(...vals(k)) : null);
  const sum = (k: string) => (vals(k).length ? round(vals(k).reduce((a, b) => a + b, 0), 1) : null);
  const past = days.filter((d) => d.kind === "reanalysis");
  let dry = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    const p = past[i].precip_mm;
    if (typeof p === "number" && p >= 1) break;
    dry++;
  }
  return {
    tmax_c_max: max("tmax_c"),
    rh_min_pct_min: min("rh_min_pct"),
    wind_max_kmh_max: max("wind_max_kmh"),
    gust_max_kmh_max: max("gust_max_kmh"),
    vpd_max_kpa_max: max("vpd_max_kpa"),
    precip_mm_total: sum("precip_mm"),
    days_hot_dry_windy: days.filter((d) => (d.tmax_c as number) >= 30 && (d.rh_min_pct as number) <= 30 && (d.wind_max_kmh as number) >= 20).length,
    dry_days_at_end_of_past: past.length ? dry : null,
    note: "days_hot_dry_windy counts days with tmax >= 30 C, rh_min <= 30 % and wind_max >= 20 km/h (the 30-30-30 rule of thumb, wind in km/h). dry_days_at_end_of_past: consecutive past days before the last past date with < 1 mm.",
  };
}

export function planRequests(from: string, to: string, now = today()) {
  const reqs: { kind: "archive" | "forecast"; from: string; to: string }[] = [];
  if (from <= now) reqs.push({ kind: "archive", from, to: to < now ? to : now });
  if (to > now) reqs.push({ kind: "forecast", from: from > now ? from : addDays(now, 1), to });
  return reqs;
}

export async function fireWeather(p: { lat: number; lon: number; from: string; to: string }) {
  const now = today();
  const caveats: LiveCaveat[] = [
    {
      code: "model_not_station",
      message: "Values are gridded model output (ERA5 / ERA5-Land reanalysis about 9-25 km, ECMWF IFS and other models for recent and future days) at one point, not station measurements and not an area average.",
    },
    { code: "single_point", message: "The point is the region's representative point (or the lat/lon given); weather varies inside large regions." },
  ];
  const days: WeatherDay[] = [];
  let grid: ReturnType<typeof parseOpenMeteo>["grid"] | null = null;
  const reqs = planRequests(p.from, p.to, now);
  const parts = await Promise.all(reqs.map(async (r) => {
    try {
      const json = await fetchUpstream(openMeteoUrl(r.kind, p.lat, p.lon, r.from, r.to), "json", r.kind === "archive" ? TTL_ARCHIVE : TTL_FORECAST);
      return parseOpenMeteo(json, r.kind === "archive" ? "reanalysis" : "forecast");
    } catch (e) {
      caveats.push(upstreamError(`Open-Meteo ${r.kind}`, e));
      return null;
    }
  }));
  for (const part of parts) if (part) { days.push(...part.days); grid ??= part.grid; }
  if (days.some((d) => d.kind === "forecast")) {
    caveats.push({ code: "forecast", message: "Days with kind 'forecast' are model forecasts; skill drops after about 5 days." });
  }
  if (days.some((d) => d.kind === "reanalysis" && daysBetween(d.date, now) <= 7)) {
    caveats.push({ code: "provisional", message: "The last 5-7 past days come from ECMWF IFS analysis until ERA5 catches up; they can change slightly." });
  }
  return {
    point: { lat: p.lat, lon: p.lon },
    grid_cell: grid,
    window: { from: p.from, to: p.to },
    units: { tmax_c: "°C", rh_min_pct: "%", wind_max_kmh: "km/h at 10 m", gust_max_kmh: "km/h", precip_mm: "mm",
             et0_mm: "mm (FAO-56 reference evapotranspiration)", vpd_max_kpa: "kPa", soil_moisture_0_7cm_m3m3: "m³/m³" },
    summary: summarize(days),
    days,
    fire_danger_index: "Not included: no key-free point API for EFFIS / CEMS FWI was found (14 Nov 2026). See https://forest-fire.emergency.copernicus.eu/ for the FWI maps.",
    caveats,
  };
}
