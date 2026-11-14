// Pure logic behind the MCP tools: takes loaded JSON, returns plain objects. No I/O, no DOM.
// Data contract: docs/wiki/data-contract.md. Tool design: docs/wiki/agent-access.md.
import type {
  CountryCode,
  IndexFile,
  IndexRegion,
  Level,
  MonthRecord,
  RegionFile,
  Series,
} from "../../src/lib/contract.ts";
import { regionAt, type RegionCollection, type RegionFeature } from "../../src/lib/geo.ts";
import { serializeState } from "../../src/lib/url-state.ts";

export const PUBLIC_URL = "https://burning-calendar.vercel.app/";
export const MAX_MONTHS = 120;
export const NEAREST_MAX_KM = 5;

export interface Period {
  start: string; // YYYY-MM
  end: string;
}

type Month = MonthRecord & {
  baseline_median?: number | null;
  baseline_p90?: number | null;
  baseline_years?: string | null;
};

export interface Caveat {
  code:
    | "relative_mode"
    | "backcast"
    | "backcast_terra"
    | "outage"
    | "detections_not_fires"
    | "coverage"
    | "out_of_coverage";
  message: string;
}

const DETECTIONS: Caveat = {
  code: "detections_not_fires",
  message: "Counts are satellite active fire detections, not fires or burned area; one fire can give many detections.",
};

export const ANOMALY_DEFINITION =
  "A month is an anomaly (anom: true) when its value is above baseline_p90, the 90th percentile of the same calendar month over baseline_years (the preceding 10 years; 2002-2011 without the target year before 2012). anom_pct is its percentile rank in that baseline.";

export function countryOf(id: string): CountryCode | null {
  if (/^(GR|EL\d\d)$/.test(id)) return "gr";
  if (/^(AR|\d\d)$/.test(id)) return "ar";
  return null;
}

export function viewUrl(country: CountryCode, region: string | null, from: string | null = null,
                        to: string | null = null, series: Series = "harm"): string {
  return PUBLIC_URL + serializeState({ country, region, from, to, series });
}

const dataUrl = (country: CountryCode, id: string, ext: "json" | "csv") =>
  `${PUBLIC_URL}data/v1/${country}/regions/${id}.${ext}`;

/** Region names come from NUTS / IGN through the pipeline; strip control characters and cap length. */
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80);

const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

/** Series the calendar, anomalies and totals use: harm in harmonized mode, MODIS in relative mode. */
const seriesOf = (mode: RegionFile["mode"]): Series => (mode === "harmonized" ? "harm" : "modis");

/** data/outages.csv lists MODIS (Aqua) gaps only, so an outage matters only where the value comes from MODIS. */
const modisOutage = (m: Month, mode: RegionFile["mode"]) => m.outage && (mode === "relative" || m.src !== "observed");

function dropNulls<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

function caveatsFor(mode: RegionFile["mode"], months: Month[]): Caveat[] {
  const out: Caveat[] = [];
  if (mode === "relative") {
    out.push({
      code: "relative_mode",
      message: "This region failed harmonization validation: harm is null and calendar and anomalies use MODIS counts only. Do not compare its counts with harmonized regions.",
    });
  }
  const n = (src: string) => months.filter((m) => m.src === src).length;
  if (mode === "harmonized" && n("backcast") > 0) {
    out.push({
      code: "backcast",
      message: `${n("backcast")} month(s) before 2012 are modelled from MODIS, not observed. Report them with the harm_lo to harm_hi range.`,
    });
  }
  if (mode === "harmonized" && n("backcast_terra") > 0) {
    out.push({
      code: "backcast_terra",
      message: `${n("backcast_terra")} month(s) from Nov 2000 to Jun 2002 use Terra only with a chained factor; uncertainty is higher.`,
    });
  }
  const outages = months.filter((m) => modisOutage(m, mode)).map((m) => m.ym);
  if (outages.length) {
    out.push({ code: "outage", message: `Known MODIS data gaps of 3 or more days in: ${outages.join(", ")}; counts there may be low.` });
  }
  out.push(DETECTIONS);
  return out;
}

// ---------- coverage (every tool) ----------

export function coverageCaveat(period: Period): Caveat {
  return {
    code: "coverage",
    message: `Data cover ${period.start} to ${period.end}. VIIRS S-NPP stopped on 2 Nov 2026 and the splice to NOAA-20 is not done, so there are no values after ${period.end} and nothing for the current month.`,
  };
}

/** Adds `coverage` and the coverage caveat to any tool result. */
export function withCoverage<T extends object>(result: T, period: Period): T & { coverage: Period; caveats: Caveat[] } {
  const caveats = [...(((result as { caveats?: Caveat[] }).caveats) ?? []), coverageCaveat(period)];
  return { ...result, coverage: { start: period.start, end: period.end }, caveats };
}

function outOfCoverage(what: string, period: Period): Caveat {
  return { code: "out_of_coverage", message: `${what} is outside the data coverage ${period.start} to ${period.end}.` };
}

// ---------- search_regions ----------

/** annual_mean is only comparable across harmonized regions; relative regions get it as annual_mean_modis. */
function annualMeanFields(r: IndexRegion) {
  return r.mode === "harmonized"
    ? { annual_mean: r.annual_mean, annual_mean_of: "harm" as const }
    : {
        annual_mean: null, annual_mean_modis: r.annual_mean, annual_mean_of: "modis" as const,
        caveat: "relative_mode: annual_mean_modis is a raw MODIS count, not comparable with annual_mean of harmonized regions",
      };
}

export function searchRegions(indexes: IndexFile[],
                              p: { country?: "GR" | "AR"; level?: Level; query?: string; limit: number }) {
  const q = p.query?.trim().toLowerCase();
  const regions = indexes
    .filter((ix) => !p.country || ix.country === p.country)
    .flatMap((ix) => ix.regions.map((r) => ({ r, country: ix.country.toLowerCase() as CountryCode })))
    .filter(({ r }) => !p.level || r.level === p.level)
    .filter(({ r }) => !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase() === q)
    .slice(0, p.limit)
    .map(({ r, country }) => ({
      id: r.id, name: clean(r.name), country: country.toUpperCase(), level: r.level, mode: r.mode,
      peak_month: r.peak_month, onset: r.onset, end: r.end, season_length: r.season_length,
      ...annualMeanFields(r), loyo_mdape_pct: r.loyo_mdape_pct,
      view_url: viewUrl(country, r.id),
    }));
  const caveats: Caveat[] = [];
  if (regions.some((r) => r.mode === "relative")) {
    caveats.push({
      code: "relative_mode",
      message: "Regions with mode 'relative' have annual_mean null; their annual_mean_modis is a raw MODIS count on a different scale. Do not rank them with harmonized regions.",
    });
  }
  return { count: regions.length, regions, caveats };
}

// ---------- get_region_series ----------

export const MONTH_FIELDS = [
  "ym", "modis", "viirs", "harm", "harm_lo", "harm_hi", "src", "fit_level", "anom_pct", "anom",
  "outage", "outage_affects", "baseline_median", "baseline_p90", "baseline_years",
] as const;
export type MonthField = (typeof MONTH_FIELDS)[number];

export function defaultFields(mode: RegionFile["mode"]): MonthField[] {
  return mode === "harmonized"
    ? ["ym", "harm", "harm_lo", "harm_hi", "src", "anom", "outage", "outage_affects"]
    : ["ym", "modis", "viirs", "src", "anom", "outage", "outage_affects"];
}

/** Month record as the tools expose it: outage only where it affects the value, nulls dropped. */
function monthOut(m: Month, mode: RegionFile["mode"], fields: readonly MonthField[]) {
  const outage = modisOutage(m, mode);
  const full: Record<MonthField, unknown> = {
    ym: m.ym, modis: m.modis, viirs: m.viirs, harm: r1(m.harm), harm_lo: r1(m.harm_lo), harm_hi: r1(m.harm_hi),
    src: m.src, fit_level: m.fit_level, anom_pct: m.anom_pct, anom: m.anom,
    outage: outage ? true : null, outage_affects: outage ? "modis" : null,
    baseline_median: m.baseline_median ?? null, baseline_p90: m.baseline_p90 ?? null,
    baseline_years: m.baseline_years ?? null,
  };
  const keep = new Set<MonthField>(["ym", ...fields]);
  return dropNulls(Object.fromEntries(MONTH_FIELDS.filter((k) => keep.has(k)).map((k) => [k, full[k]])));
}

function totalsByYear(months: Month[], mode: RegionFile["mode"]) {
  const series = seriesOf(mode);
  const by = new Map<number, Month[]>();
  for (const m of months) {
    const y = Number(m.ym.slice(0, 4));
    by.set(y, [...(by.get(y) ?? []), m]);
  }
  return [...by.entries()].map(([year, ms]) => ({
    year, series,
    total: r1(ms.reduce((a, m) => a + ((series === "harm" ? m.harm : m.modis) ?? 0), 0)),
    n_months: ms.length,
    partial: ms.length < 12,
  }));
}

export function regionSeries(region: RegionFile,
                             p: { from: string; to: string; aggregate: "month" | "year"; fields?: MonthField[] },
                             period: Period) {
  const country = countryOf(region.id)!;
  if (p.from > p.to) throw new Error("from must not be after to");
  const caveatsExtra: Caveat[] = [];
  const from = p.from < period.start ? period.start : p.from;
  const to = p.to > period.end ? period.end : p.to;
  if (from !== p.from || to !== p.to) {
    caveatsExtra.push(outOfCoverage(`Part of the requested range ${p.from} to ${p.to}`, period));
  }
  const months = from <= to ? (region.months as Month[]).filter((m) => m.ym >= from && m.ym <= to) : [];
  if (p.aggregate === "month" && months.length > MAX_MONTHS) {
    throw new Error(`Range has ${months.length} months; at most ${MAX_MONTHS} monthly records per call. Use aggregate "year" or a shorter range.`);
  }
  const fields = p.fields?.length ? p.fields : defaultFields(region.mode);
  const base = {
    region_id: region.id, name: clean(region.name), mode: region.mode, unit: region.units,
    requested: { from: p.from, to: p.to },
    returned: months.length ? { from: months[0].ym, to: months[months.length - 1].ym } : null,
    aggregate: p.aggregate,
    anomaly_definition: ANOMALY_DEFINITION,
    caveats: [...caveatsFor(region.mode, months), ...caveatsExtra],
    view_url: viewUrl(country, region.id, months.length ? from : null, months.length ? to : null),
    data_url: dataUrl(country, region.id, "json"),
    csv_url: dataUrl(country, region.id, "csv"),
  };
  if (p.aggregate === "month") {
    return { ...base, fields, records: months.map((m) => monthOut(m, region.mode, fields)),
             totals: totalsByYear(months, region.mode) };
  }
  return { ...base, records: yearly(months, region.mode) };
}

/** Calendar-year sums. modis and viirs are raw counts; harm is VIIRS-equivalent (null in relative mode). */
function yearly(months: Month[], mode: RegionFile["mode"]) {
  return totalsByYear(months, mode).map((t) => {
    const ms = months.filter((m) => m.ym.startsWith(`${t.year}-`));
    return dropNulls({
      year: t.year, n_months: t.n_months, partial: t.partial,
      harm: mode === "harmonized" ? t.total : null,
      modis: ms.reduce((a, m) => a + m.modis, 0),
      viirs: ms.every((m) => m.viirs !== null) ? ms.reduce((a, m) => a + (m.viirs ?? 0), 0) : null,
      backcast_months: ms.filter((m) => m.src !== "observed").length,
      anomaly_months: ms.filter((m) => m.anom).map((m) => m.ym),
    });
  });
}

// ---------- get_season_calendar ----------

export function seasonCalendar(region: RegionFile, year: number | undefined, period: Period) {
  const country = countryOf(region.id)!;
  const loyo = (region.validation as { loyo?: { annual_mdape_pct?: number | null } }).loyo;
  const caveats = caveatsFor(region.mode, []);
  const years = year === undefined ? region.years : region.years.filter((y) => y.season_year === year);
  if (year !== undefined && !years.length) {
    caveats.push(outOfCoverage(`Season year ${year} (complete season years only)`, period));
  }
  return {
    region_id: region.id, name: clean(region.name), mode: region.mode,
    metrics_on: seriesOf(region.mode),
    climatology: region.summary,
    years,
    loyo_mdape_pct: loyo?.annual_mdape_pct ?? null,
    notes: "Months are 1-12. onset/end: months where the cumulative season count passes 10 % and 90 %. A season year starts at season_start_month and is labelled with the calendar year holding most of its months.",
    caveats,
    view_url: viewUrl(country, region.id),
  };
}

// ---------- get_anomalies ----------

export function anomaliesFor(region: RegionFile, year: number, period: Period) {
  const country = countryOf(region.id)!;
  const series = seriesOf(region.mode);
  const months = (region.months as Month[]).filter((m) => m.ym.startsWith(`${year}-`));
  const rows = months.map((m) => {
    const value = series === "harm" ? m.harm : m.modis;
    const med = m.baseline_median ?? null;
    const outage = modisOutage(m, region.mode);
    return dropNulls({
      ym: m.ym, value: r1(value), src: m.src, anom_pct: m.anom_pct, anom: m.anom,
      baseline_median: med, baseline_p90: m.baseline_p90 ?? null, baseline_years: m.baseline_years ?? null,
      ratio_to_median: value !== null && med ? Math.round((value / med) * 10) / 10 : null,
      outage: outage ? true : null, outage_affects: outage ? "modis" : null,
    });
  });
  const caveats = caveatsFor(region.mode, months);
  if (!months.length) caveats.push(outOfCoverage(`Year ${year}`, period));
  return {
    region_id: region.id, name: clean(region.name), mode: region.mode, series, year,
    anomaly_definition: ANOMALY_DEFINITION,
    flagged: rows.filter((r) => r.anom).map((r) => r.ym),
    months: rows,
    caveats,
    view_url: viewUrl(country, region.id, `${year}-01`, `${year}-12`, series),
  };
}

// ---------- compare_regions ----------

export type CompareMetric = "annual_mean" | "season_total" | "peak_month" | "onset" | "end" | "season_length" | "loyo_mdape_pct";
const COUNT_METRICS: CompareMetric[] = ["annual_mean", "season_total"];

export function compareRegions(items: { country: CountryCode; entry: IndexRegion; region?: RegionFile }[],
                               metric: CompareMetric, year?: number) {
  const isCount = COUNT_METRICS.includes(metric);
  const rows = items.map(({ country, entry, region }) => {
    let raw: number | null;
    if (metric === "season_total") {
      if (!region || year === undefined) throw new Error("season_total needs a year");
      raw = region.years.find((y) => y.season_year === year)?.total ?? null;
    } else {
      raw = entry[metric] ?? null;
    }
    // Count metrics of relative regions are raw MODIS counts: never put them in `value`.
    const relCount = isCount && entry.mode === "relative";
    return dropNulls({
      id: entry.id, name: clean(entry.name), country: country.toUpperCase(), mode: entry.mode,
      value: relCount ? null : raw, value_modis: relCount ? raw : null,
      view_url: viewUrl(country, entry.id),
    }) as { id: string; mode: string; value?: number; value_modis?: number; view_url: string };
  });
  const relative = rows.filter((r) => r.mode === "relative").map((r) => r.id);
  const ranking_allowed = !(isCount && relative.length);
  const caveats: Caveat[] = [];
  if (!ranking_allowed) {
    caveats.push({
      code: "relative_mode",
      message: `Regions ${relative.join(", ")} are in relative mode: value is null and value_modis is a raw MODIS count on a different scale. No absolute ranking is given.`,
    });
  }
  if (isCount) {
    caveats.push(DETECTIONS);
    if (ranking_allowed) rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  }
  return { metric, year: year ?? null, ranking_allowed, rows, caveats };
}

// ---------- find_region_at ----------

/** Shortest distance in km from a point to a region's boundary (local equirectangular, fine at 5 km). */
function distanceKm(f: RegionFeature, lon: number, lat: number): number {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let best = Infinity;
  for (const rings of polys) {
    for (const ring of rings) {
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - lon) * kx, ay = (ring[i - 1][1] - lat) * ky;
        const bx = (ring[i][0] - lon) * kx, by = (ring[i][1] - lat) * ky;
        const dx = bx - ax, dy = by - ay;
        const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
  }
  return best;
}

export type PointMatch =
  | { found: true; country: CountryCode; id: string }
  | { found: false; nearest: { country: CountryCode; id: string; distance_km: number } | null };

/** Region containing the point; otherwise the nearest region within NEAREST_MAX_KM, if any. */
export function locate(geo: Record<CountryCode, RegionCollection>, lat: number, lon: number): PointMatch {
  for (const country of ["gr", "ar"] as const) {
    const f = regionAt(geo[country], lon, lat);
    if (f) return { found: true, country, id: f.properties.id };
  }
  let nearest: { country: CountryCode; id: string; distance_km: number } | null = null;
  for (const country of ["gr", "ar"] as const) {
    for (const f of geo[country].features) {
      const d = distanceKm(f, lon, lat);
      if (d <= NEAREST_MAX_KM && (!nearest || d < nearest.distance_km)) {
        nearest = { country, id: f.properties.id, distance_km: Math.round(d * 100) / 100 };
      }
    }
  }
  return { found: false, nearest };
}

/** What find_region_at returns for a matched region: summary, last 3 season years, links. */
export function regionSummary(country: CountryCode, entry: IndexRegion, region: RegionFile) {
  const c = region.summary;
  return {
    id: entry.id, name: clean(entry.name), country: country.toUpperCase(), level: entry.level, mode: entry.mode,
    climatology: { onset: c.onset, peak_month: c.peak_month, end: c.end, season_length: c.season_length,
                   bimodal: c.bimodal, season_start_month: c.season_start_month },
    ...annualMeanFields(entry),
    last_season_years: region.years.slice(-3).map((y) => ({ season_year: y.season_year, total: y.total, peak_month: y.peak_month })),
    season_totals_of: seriesOf(entry.mode),
    caveats: caveatsFor(entry.mode, []),
    view_url: viewUrl(country, entry.id),
    data_url: dataUrl(country, entry.id, "json"),
  };
}

// ---------- get_methodology ----------

export const METHODOLOGY: Record<string, string> = {
  overview:
    "Burning calendar: monthly NASA FIRMS active fire detection counts for Greece (13 NUTS2 regions) and Argentina (24 provinces), Nov 2000 to Dec 2025, on one scale: VIIRS S-NPP 375 m equivalent detections. VIIRS counts are used as observed from 2012; earlier months are MODIS (Terra+Aqua) counts times a factor fitted per region, calendar month and day/night on 2012-2019. Input: FIRMS standard processing archive, type 0 (presumed vegetation fire), 0.01 degree cells with 16 or more detection days a year removed as static sources.",
  harmonization:
    "Factor F = sum(VIIRS) / sum(MODIS) per region x calendar month x day/night over 2012-2019. A stratum needs at least 30 MODIS detections in the window and 5 per year; otherwise it falls back to region x season x day/night, then region x day/night, then national x day/night. Nov 2000 to Jun 2002 (Terra only) use a chained factor: (Terra+Aqua)/Terra fitted on 2003-2011, then F. The uncertainty band harm_lo..harm_hi is the modelled value times the 10th and 90th percentile of leave-one-year-out obs/pred ratios, pooled by meteorological season.",
  validation:
    "Leave-one-year-out over 2012-2019: refit without year y, predict y from MODIS, compare with VIIRS. National median absolute error of annual totals: Greece 5.4 %, Argentina 1.5 %. Time split (fit 2012-2019, test 2020-2025): Greece 7.1 %, Argentina 7.0 %. The Greek night VIIRS/MODIS ratio falls 3.3 % per year over 2012-2025 (orbit drift likely, 2023 is also an extreme fire year).",
  modes:
    "A region is 'relative' when its leave-one-year-out median absolute annual error is above 25 %, or when the harmonized series misses the VIIRS peak month in more than one more held-out season year than raw MODIS does. Relative regions have harm = null; their calendar and anomalies use MODIS counts only. The peak-month part of this rule was amended on 14 Nov 2026 after seeing results. Greece: EL62 is relative. Argentina: 02 (CABA), 58 (Neuquén), 94 (Tierra del Fuego) are relative.",
  anomalies:
    "anom_pct is the percentile rank of a month among the same calendar month of the preceding 10 years; for years before 2012 the baseline is 2002-2011 without the target year. anom is true above the baseline 90th percentile. baseline_median and baseline_p90 are stored per month. Computed on harm in harmonized mode, on MODIS in relative mode.",
  calendar:
    "Season year starts at the climatological minimum month of the region's MODIS series and is labelled with the calendar year holding most of its months. Onset and end: months where the cumulative season count passes 10 % and 90 % (Freeborn 2014). Peak month: highest mean count (Giglio 2006). bimodal: two peaks at least 2 months apart with a trough below 50 % of the smaller one.",
  limits:
    "Detections are not fires or burned area. Back-cast months (before 2012) are modelled. Factors are constant per region-month and do not follow land-cover change. acq_date is UTC, so some Argentine night detections fall on the next day. Known satellite outages are listed manually (Aqua Aug-Sep 2020). Series ends Dec 2025; S-NPP ended 2 Nov 2026 and the NOAA-20 splice is not done.",
};
