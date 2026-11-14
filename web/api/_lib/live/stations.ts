// get_weather_stations: daily station records near a region from Meteostat (key-free per-station yearly CSV).
import { cleanText, fetchUpstream, haversineKm, type LiveCaveat, round, type SourceInfo, upstreamError } from "./core.ts";
import { METEOSTAT_STATIONS, type MeteostatStation } from "./meteostat-stations.ts";
import { inFeatures, type LiveRegion } from "./regions.ts";

export const METEOSTAT: SourceInfo = {
  name: "Meteostat daily station data (METAR, DWD, NOAA and other providers)",
  url: "https://meteostat.net/",
  licence: "CC BY 4.0: \"You must give credit to Meteostat and its meteorological data providers\" (dev.meteostat.net/license).",
  attribution: "Weather station data: Meteostat and its data providers (CC BY 4.0)",
};

/** Providers that are model forecasts, not measurements. */
const MODEL_PROVIDERS = new Set(["dwd_mosmix", "metno_forecast", "model"]);
const FIELDS = { temp: "tavg_c", tmin: "tmin_c", tmax: "tmax_c", rhum: "rh_pct", prcp: "precip_mm", wspd: "wind_avg_kmh" } as const;
type Field = keyof typeof FIELDS;
const NEAR_KM = 75;
const TTL = 60 * 60_000;

export const meteostatUrl = (id: string, year: number) => {
  if (!/^[0-9A-Z]{5}$/.test(id)) throw new Error("bad station id");
  return new URL(`https://data.meteostat.net/daily/${year}/${id}.csv.gz`);
};

export interface StationDay {
  date: string;
  tavg_c: number | null;
  tmin_c: number | null;
  tmax_c: number | null;
  rh_pct: number | null;
  precip_mm: number | null;
  wind_avg_kmh: number | null;
  /** Fields whose value comes only from a model forecast (MOSMIX), not from a measurement. */
  model_fields?: string[];
}

/** Meteostat daily CSV: year,month,day,temp,temp_source,tmin,tmin_source,... (header-driven). */
export function parseMeteostat(csv: string, from: string, to: string): StationDay[] {
  const lines = csv.trim().split(/\r?\n/);
  const head = (lines.shift() ?? "").split(",");
  const col = (name: string) => head.indexOf(name);
  const [iy, im, id] = [col("year"), col("month"), col("day")];
  if (iy < 0 || im < 0 || id < 0) return [];
  const out: StationDay[] = [];
  for (const line of lines) {
    const c = line.split(",");
    const date = `${c[iy]}-${String(c[im]).padStart(2, "0")}-${String(c[id]).padStart(2, "0")}`;
    if (!/^\d{4}-\d\d-\d\d$/.test(date) || date < from || date > to) continue;
    const row: StationDay = { date, tavg_c: null, tmin_c: null, tmax_c: null, rh_pct: null, precip_mm: null, wind_avg_kmh: null };
    const model: string[] = [];
    for (const f of Object.keys(FIELDS) as Field[]) {
      const i = col(f);
      if (i < 0 || c[i] === "" || c[i] === undefined) continue;
      const v = Number(c[i]);
      if (!Number.isFinite(v)) continue;
      row[FIELDS[f]] = round(v, 1);
      const src = (c[col(`${f}_source`)] ?? "").split(/\s+/).filter(Boolean);
      if (src.length && src.every((s) => MODEL_PROVIDERS.has(s))) model.push(FIELDS[f]);
    }
    if (model.length) row.model_fields = model;
    out.push(row);
  }
  return out;
}

/** A day with at least one measured (non-model) value. */
export const hasMeasurement = (d: StationDay) =>
  Object.values(FIELDS).some((k) => d[k] !== null && !(d.model_fields ?? []).includes(k));

/** Stations inside the region first (by distance to its point), then others within NEAR_KM of the point. */
export function pickStations(region: LiveRegion, from: string, max: number, list: MeteostatStation[] = METEOSTAT_STATIONS) {
  const country = region.country.toUpperCase();
  return list
    .filter((s) => s.country === country && (s.obs_end ?? "") >= from)
    .map((s) => ({ s, inside: !!inFeatures(region.features, s.lat, s.lon), km: haversineKm(region.point.lat, region.point.lon, s.lat, s.lon) }))
    .filter((x) => x.inside || x.km <= NEAR_KM)
    .sort((a, b) => Number(b.inside) - Number(a.inside) || a.km - b.km)
    .slice(0, max);
}

export async function weatherStations(region: LiveRegion, p: { from: string; to: string; max_stations: number }) {
  const caveats: LiveCaveat[] = [
    { code: "station_lag", message: "Measured values (METAR, synoptic) reach Meteostat with a delay of several days; recent days are often filled from the DWD MOSMIX model forecast, listed per day in model_fields. Treat model_fields values as forecasts, not observations." },
  ];
  const picked = pickStations(region, p.from, p.max_stations);
  const years = [...new Set([Number(p.from.slice(0, 4)), Number(p.to.slice(0, 4))])];
  const stations = await Promise.all(picked.map(async ({ s, inside, km }) => {
    let days: StationDay[] = [];
    let error: string | null = null;
    try {
      const texts = await Promise.all(years.map((y) => fetchUpstream<string>(meteostatUrl(s.id, y), "gzip-text", TTL)));
      days = texts.flatMap((t) => (t ? parseMeteostat(t, p.from, p.to) : []));
    } catch (e) {
      caveats.push(upstreamError(`Meteostat station ${s.id}`, e));
      error = "upstream_error";
    }
    const observed = days.filter(hasMeasurement);
    return {
      id: s.id, name: cleanText(s.name, 60), lat: s.lat, lon: s.lon, elevation_m: s.elev,
      distance_km: round(km, 1), inside_region: inside,
      days_returned: days.length,
      days_with_measurements: observed.length,
      last_measured_date: observed.length ? observed[observed.length - 1].date : null,
      ...(error ? { error } : {}),
      days,
    };
  }));
  return {
    region_point: region.point,
    window: { from: p.from, to: p.to },
    units: { tavg_c: "°C", tmin_c: "°C", tmax_c: "°C", rh_pct: "% (daily mean)", precip_mm: "mm", wind_avg_kmh: "km/h (daily mean)" },
    stations,
    note: stations.length ? undefined
      : `No Meteostat station with measurements after ${p.from} inside the region or within ${NEAR_KM} km of its point. Use get_fire_weather for model values.`,
    caveats,
  };
}
