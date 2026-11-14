// get_recent_detections: NASA FIRMS near-real-time detections for a region (area API, needs FIRMS_MAP_KEY).
import type { MonthRecord } from "../../../src/lib/contract.ts";
import {
  addDays, fetchUpstream, type LiveCaveat, round, type SourceInfo, today, UpstreamError, upstreamError,
} from "./core.ts";
import { inFeatures, type LiveRegion, loadRegionFile } from "./regions.ts";

export const FIRMS: SourceInfo = {
  name: "NASA FIRMS near-real-time active fires (VIIRS NOAA-20, VIIRS NOAA-21, MODIS), LANCE",
  url: "https://firms.modaps.eosdis.nasa.gov/",
  licence: "NASA open data, no restrictions on reuse; NASA asks for acknowledgement (earthdata.nasa.gov data use policy).",
  attribution: "NRT active fire data courtesy of NASA FIRMS (LANCE), https://earthdata.nasa.gov/firms",
};

export const NRT_SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"] as const;
type NrtSource = (typeof NRT_SOURCES)[number];
const SENSOR: Record<NrtSource, string> = { VIIRS_NOAA20_NRT: "viirs_noaa20", VIIRS_NOAA21_NRT: "viirs_noaa21", MODIS_NRT: "modis" };
const TTL = 10 * 60_000;
const MAX_PER_REQUEST = 5;

/** Key from the Vercel env only; null when missing or malformed. Never logged or returned. */
export function firmsKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const k = env.FIRMS_MAP_KEY?.trim();
  return k && /^[0-9a-zA-Z]{20,64}$/.test(k) ? k : null;
}

/** Area API: /api/area/csv/{key}/{source}/{w,s,e,n}/{1-5 days}[/{YYYY-MM-DD}]; without a date, the last N days up to today. */
export function firmsUrl(key: string, source: NrtSource, bbox: [number, number, number, number], days: number, date?: string): URL {
  const [w, s, e, n] = bbox;
  const down = (x: number) => Math.floor(x * 100 + 1e-9) / 100;
  const up = (x: number) => Math.ceil(x * 100 - 1e-9) / 100;
  const area = [down(w), down(s), up(e), up(n)].join(",");
  return new URL(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/${area}/${days}${date ? `/${date}` : ""}`);
}

/** Split a window of `days` ending today into area API calls of at most 5 days. */
export function chunks(days: number, now = today()): { days: number; date?: string }[] {
  const out: { days: number; date?: string }[] = [{ days: Math.min(days, MAX_PER_REQUEST) }];
  let left = days - MAX_PER_REQUEST;
  let end = addDays(now, -MAX_PER_REQUEST);
  while (left > 0) {
    const n = Math.min(left, MAX_PER_REQUEST);
    out.push({ days: n, date: addDays(end, -(n - 1)) });
    end = addDays(end, -n);
    left -= n;
  }
  return out;
}

export interface Hotspot {
  date: string;
  time_utc: string;
  sensor: string;
  lat: number;
  lon: number;
  frp_mw: number | null;
  confidence: string;
  daynight: string;
  region_id?: string;
}

export function parseFirmsCsv(csv: string, source: NrtSource): Hotspot[] {
  const lines = csv.trim().split(/\r?\n/);
  const head = (lines.shift() ?? "").split(",");
  if (head[0] !== "latitude") throw new UpstreamError("firms.modaps.eosdis.nasa.gov", "unexpected answer (not a FIRMS CSV)");
  const ix = (k: string) => head.indexOf(k);
  const [ilat, ilon, idate, itime, iconf, ifrp, idn] = ["latitude", "longitude", "acq_date", "acq_time", "confidence", "frp", "daynight"].map(ix);
  return lines.map((l) => l.split(",")).filter((c) => c.length === head.length).map((c) => ({
    date: /^\d{4}-\d\d-\d\d$/.test(c[idate]) ? c[idate] : "",
    time_utc: /^\d{1,4}$/.test(c[itime]) ? c[itime].padStart(4, "0").replace(/(\d\d)(\d\d)/, "$1:$2") : "",
    sensor: SENSOR[source],
    lat: Number(c[ilat]),
    lon: Number(c[ilon]),
    frp_mw: round(Number(c[ifrp]), 1),
    confidence: String(c[iconf] ?? "").slice(0, 8),
    daynight: c[idn] === "D" || c[idn] === "N" ? c[idn] : "",
  })).filter((h) => h.date && Number.isFinite(h.lat) && Number.isFinite(h.lon));
}

/** Median of observed VIIRS S-NPP counts for one calendar month over the last 10 years of the static calendar. */
export function monthBaseline(months: Pick<MonthRecord, "ym" | "viirs">[], month: number) {
  const mm = String(month).padStart(2, "0");
  const vals = months.filter((m) => m.ym.endsWith(`-${mm}`) && m.viirs !== null).slice(-10);
  if (!vals.length) return null;
  const v = vals.map((m) => m.viirs as number).sort((a, b) => a - b);
  const median = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  const days = new Date(Date.UTC(2001, month, 0)).getUTCDate();
  return { month, years: `${vals[0].ym.slice(0, 4)}-${vals[vals.length - 1].ym.slice(0, 4)}`, median_month_total: median, median_per_day: round(median / days, 2) };
}

export const NOT_CONFIGURED: LiveCaveat = {
  code: "not_configured",
  message: "FIRMS near-real-time detections need a free FIRMS MAP_KEY set as the server environment variable FIRMS_MAP_KEY; it is not set. Live FIRMS map: https://firms.modaps.eosdis.nasa.gov/map/",
};

export async function recentDetections(region: LiveRegion, days: number, env: NodeJS.ProcessEnv = process.env) {
  const caveats: LiveCaveat[] = [
    { code: "detections_not_fires", message: "Counts are satellite active fire detections, not fires or burned area; one fire can give many detections." },
    { code: "nrt_not_harmonized", message: "NRT detections are not filtered like the calendar (no type field, static industrial sources such as flares stay in) and NOAA-20/21 are not spliced to the S-NPP scale; compare with the baseline as an order of magnitude only." },
    { code: "provisional", message: "NRT data arrive about 3 h after the overpass; today is incomplete and geolocation can be worse than in the standard product." },
  ];
  const now = today();
  const window = { from: addDays(now, -(days - 1)), to: now, days };
  const key = firmsKey(env);
  if (!key) {
    return { region_id: region.id, window, configured: false, counts_by_day: [], totals: {}, top_hotspots: [], caveats: [NOT_CONFIGURED, ...caveats] };
  }
  const all: Hotspot[] = [];
  const failed: string[] = [];
  await Promise.all(NRT_SOURCES.flatMap((src) => chunks(days, now).map(async (c) => {
    try {
      const csv = await fetchUpstream<string>(firmsUrl(key, src, region.bbox, c.days, c.date), "text", TTL);
      if (csv) all.push(...parseFirmsCsv(csv, src));
    } catch (e) {
      failed.push(src);
      const msg = e instanceof Error ? e.message.split(key).join("***") : "error";
      caveats.push(upstreamError(`FIRMS ${src}`, new UpstreamError("firms.modaps.eosdis.nasa.gov", msg.replace(/^firms\.modaps\.eosdis\.nasa\.gov: /, ""))));
    }
  })));

  const isCountry = region.level === "country";
  const inside = all.filter((h) => h.date >= window.from && h.date <= window.to).flatMap((h) => {
    const f = inFeatures(region.features, h.lat, h.lon);
    return f ? [{ ...h, region_id: f.properties.id }] : [];
  });
  const seen = new Set<string>();
  const unique = inside.filter((h) => {
    const k = `${h.sensor}|${h.date}|${h.time_utc}|${h.lat}|${h.lon}`;
    return !seen.has(k) && seen.add(k);
  });

  const byDay = new Map<string, Record<string, number>>();
  for (let d = window.from; d <= window.to; d = addDays(d, 1)) byDay.set(d, { viirs_noaa20: 0, viirs_noaa21: 0, modis: 0 });
  for (const h of unique) byDay.get(h.date)![h.sensor]++;
  const totals = { viirs_noaa20: 0, viirs_noaa21: 0, modis: 0 } as Record<string, number>;
  for (const h of unique) totals[h.sensor]++;

  const regionFile = await loadRegionFile(region.country, region.id).catch(() => null);
  const base = regionFile ? monthBaseline(regionFile.months, Number(now.slice(5, 7))) : null;
  const fullDays = days > 1 ? days - 1 : 1; // leave out today (incomplete) when there are other days
  const n20 = [...byDay.entries()].filter(([d]) => days === 1 || d < now).reduce((a, [, v]) => a + v.viirs_noaa20, 0);

  const byRegion = isCountry
    ? Object.entries(unique.reduce<Record<string, number>>((a, h) => ((a[h.region_id!] = (a[h.region_id!] ?? 0) + 1), a), {}))
        .map(([id, n]) => ({ region_id: id, detections: n })).sort((a, b) => b.detections - a.detections).slice(0, 10)
    : undefined;

  return {
    region_id: region.id,
    window,
    configured: true,
    sources_failed: failed.length ? NRT_SOURCES.filter((x) => failed.includes(x)) : undefined,
    counts_by_day: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    totals,
    ...(byRegion ? { by_region: byRegion } : {}),
    calendar_context: base && {
      ...base,
      series: "viirs (S-NPP observed, after the calendar's type and static-source filters)",
      nrt_viirs_noaa20_per_day: round(n20 / fullDays, 2),
      ratio_to_median_per_day: base.median_per_day ? round(n20 / fullDays / base.median_per_day, 2) : null,
      note: "NOAA-20 per day over the full days of the window (today left out) against the median daily rate of the same calendar month in the calendar's last 10 years. Order of magnitude only (nrt_not_harmonized).",
    },
    top_hotspots: unique.sort((a, b) => (b.frp_mw ?? 0) - (a.frp_mw ?? 0)).slice(0, 10)
      .map((h) => ({ ...h, lat: round(h.lat, 4)!, lon: round(h.lon, 4)! })),
    caveats,
  };
}
