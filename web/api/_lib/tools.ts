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

/** Index entry plus the area fields the pipeline adds (burncal-ytn). */
type Entry = IndexRegion & { area_km2?: number; density_per_1000km2?: number | null };

type Month = MonthRecord & {
  baseline_median?: number | null;
  baseline_p90?: number | null;
  baseline_years?: string | null;
  days_modis?: number;
  days_viirs?: number | null;
};

export interface Caveat {
  code:
    | "relative_mode"
    | "backcast"
    | "backcast_terra"
    | "outage"
    | "detections_not_fires"
    | "coverage"
    | "out_of_coverage"
    | "size_bias"
    | "season_window";
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

const FIRMS_DOWNLOAD = "https://firms.modaps.eosdis.nasa.gov/download/";

/** Individual detections (hotspot CSV, written by pipeline/hotspots.py) exist for Greece only. */
export function hotspotLinks(country: CountryCode, id: string) {
  return country === "gr"
    ? { detections_csv_url: `${PUBLIC_URL}data/v1/gr/detections/${id}.csv` }
    : { detections_csv_url: null,
        detections_note: `Individual detections are not hosted for Argentina (4.5 M rows); download them from NASA FIRMS: ${FIRMS_DOWNLOAD}` };
}

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

/** Countries a result talks about, from its `country` fields and region ids; both when none is found. */
export function countriesIn(result: unknown): CountryCode[] {
  const found = new Set<CountryCode>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === "string") {
        if (k === "country" && (x === "GR" || x === "AR")) found.add(x === "GR" ? "gr" : "ar");
        if (k === "region_id" || k === "id") {
          const c = countryOf(x);
          if (c) found.add(c);
        }
      } else walk(x);
    }
  };
  walk(result);
  return found.size ? (["gr", "ar"] as const).filter((c) => found.has(c)) : ["gr", "ar"];
}

function outOfCoverage(what: string, period: Period): Caveat {
  return { code: "out_of_coverage", message: `${what} is outside the data coverage ${period.start} to ${period.end}.` };
}

// ---------- season windows ----------

/** The 12 months of a season year: it starts at season_start_month and is labelled with the calendar year
 *  holding most of its months (start month 8-12 belongs to the next year's label). */
export function seasonWindow(startMonth: number, seasonYear: number): { from: string; to: string } {
  const y0 = startMonth >= 8 ? seasonYear - 1 : seasonYear;
  const endMonth = ((startMonth + 10) % 12) + 1;
  const y1 = endMonth < startMonth ? y0 + 1 : y0;
  const mm = (m: number) => String(m).padStart(2, "0");
  return { from: `${y0}-${mm(startMonth)}`, to: `${y1}-${mm(endMonth)}` };
}

function windowsCaveat(rows: { season_window?: { from: string; to: string } }[]): Caveat[] {
  const w = new Set(rows.map((r) => r.season_window && `${r.season_window.from}..${r.season_window.to}`).filter(Boolean));
  return w.size > 1
    ? [{ code: "season_window", message: "season_total covers each region's own season year (season_window per row), so the 12-month windows differ between regions. For one common window use aggregate with from/to." }]
    : [];
}

const monthsIn = (region: RegionFile, w: { from: string; to: string }) =>
  (region.months as Month[]).filter((m) => m.ym >= w.from && m.ym <= w.to);

/** Back-cast months in a sum over months and its range: harm_lo / harm_hi of the back-cast months plus the
 *  observed harm values. lo / hi are null when no month is back-cast. Harmonized mode only. */
function backcastRange(months: Month[]): { backcast_months: number; lo: number | null; hi: number | null } {
  const n = months.filter((m) => m.src !== "observed").length;
  if (!n) return { backcast_months: 0, lo: null, hi: null };
  const sum = (k: "harm_lo" | "harm_hi") =>
    r1(months.reduce((a, m) => a + ((m.src === "observed" ? m.harm : (m[k] ?? m.harm)) ?? 0), 0));
  return { backcast_months: n, lo: sum("harm_lo"), hi: sum("harm_hi") };
}

/** backcast / backcast_terra caveats for results built from sums or means over many months (season totals,
 *  climatology, aggregate). `what` names the numbers, `range` the fields that carry the range (or null). */
function backcastCaveats(mode: RegionFile["mode"], months: Month[], what: string, range: string | null,
                         note = ""): Caveat[] {
  if (mode !== "harmonized") return [];
  const n = months.filter((m) => m.src === "backcast" || m.src === "backcast_terra").length;
  const nTerra = months.filter((m) => m.src === "backcast_terra").length;
  const out: Caveat[] = [];
  if (n) {
    out.push({
      code: "backcast",
      message: `${n} monthly value(s) behind ${what} are from before 2012 and modelled from MODIS, not observed.` +
        (range ? ` Quote ${range} (harm_lo / harm_hi of those months plus the observed values; summing 10th / 90th percentile bounds overstates the range).` : "") +
        (note ? ` ${note}` : ""),
    });
  }
  if (nTerra) {
    out.push({
      code: "backcast_terra",
      message: `${nTerra} of them (Nov 2000 to Jun 2002) use Terra only with a chained factor; uncertainty is higher.`,
    });
  }
  return out;
}

/** Why a region has no season_total for a season year: the window runs past the data. */
function incompleteReason(region: RegionFile, w: { from: string; to: string }): string {
  const first = region.months[0]?.ym;
  const last = region.months[region.months.length - 1]?.ym;
  if (last && w.to > last) return `season year not complete in coverage: it ends ${w.to}, data end ${last}`;
  if (first && w.from < first) return `season year not complete in coverage: it starts ${w.from}, data start ${first}`;
  return "season year not complete in coverage";
}

function incompleteCaveat(rows: { id: string; season_window: { from: string; to: string } }[], year: number): Caveat[] {
  return rows.length
    ? [{ code: "out_of_coverage",
         message: `No complete season year ${year} (season_total missing) for ${rows.map((r) => `${r.id} (${r.season_window.from} to ${r.season_window.to})`).join(", ")}. They are not ranked; do not read them as zero or lowest.` }]
    : [];
}

// ---------- search_regions ----------

/** annual_mean and density are only comparable across harmonized regions; relative regions get them as *_modis. */
function annualMeanFields(r: Entry) {
  const area_km2 = r.area_km2 ?? null;
  const density = r.density_per_1000km2 ?? null;
  return r.mode === "harmonized"
    ? { annual_mean: r.annual_mean, annual_mean_of: "harm" as const, area_km2, density_per_1000km2: density }
    : {
        annual_mean: null, annual_mean_modis: r.annual_mean, annual_mean_of: "modis" as const,
        area_km2, density_per_1000km2: null, density_modis_per_1000km2: density,
        caveat: "relative_mode: annual_mean_modis and density_modis_per_1000km2 are raw MODIS counts, not comparable with harmonized regions",
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
  "outage", "outage_affects", "baseline_median", "baseline_p90", "baseline_years", "days_modis", "days_viirs",
  "fwi", "fwi_pct", "fwi_level", "spei3", "spei6",
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
    days_modis: m.days_modis ?? null, days_viirs: m.days_viirs ?? null,
    fwi: m.fwi ?? null, fwi_pct: m.fwi_pct ?? null, fwi_level: m.fwi_level ?? null,
    spei3: m.spei3 ?? null, spei6: m.spei6 ?? null,
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
    ...hotspotLinks(country, region.id),
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
  const harm = region.mode === "harmonized";
  const start = region.summary.season_start_month;
  const years = (year === undefined ? region.years : region.years.filter((y) => y.season_year === year)).map((y) => {
    if (!harm) return y;
    const b = backcastRange(monthsIn(region, seasonWindow(start, y.season_year)));
    return { ...y, ...dropNulls({ backcast_months: b.backcast_months, total_lo: b.lo, total_hi: b.hi }) };
  });
  const window = year === undefined ? null : seasonWindow(start, year);
  // The climatology (and so every season metric's reference) is computed over the whole series.
  const all = region.months as Month[];
  const yearsBackcast = years.some((y) => ((y as { backcast_months?: number }).backcast_months ?? 0) > 0);
  const caveats = [
    ...caveatsFor(region.mode, []),
    ...backcastCaveats(region.mode, all,
      `the climatology (all months ${all[0]?.ym} to ${all[all.length - 1]?.ym})${yearsBackcast ? " and season years with backcast_months > 0" : ""}`,
      yearsBackcast ? "total_lo to total_hi for those season years" : null),
  ];
  if (window && !years.length) {
    caveats.push(outOfCoverage(`Season year ${year} (${window.from} to ${window.to}; complete season years only)`, period));
  }
  return {
    region_id: region.id, name: clean(region.name), mode: region.mode,
    metrics_on: seriesOf(region.mode),
    climatology: region.summary,
    ...(window ? { season_window: window } : {}),
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
      days_viirs: m.days_viirs ?? null, days_modis: m.days_modis ?? null,
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

export const COMPARE_METRICS = [
  "annual_mean", "density_per_1000km2", "season_total", "peak_month", "onset", "end", "season_length", "loyo_mdape_pct",
] as const;
export type CompareMetric = (typeof COMPARE_METRICS)[number];
/** Detection-count metrics: never ranked across modes. */
export const COUNT_METRICS: readonly CompareMetric[] = ["annual_mean", "density_per_1000km2", "season_total"];

export function compareRegions(items: { country: CountryCode; entry: Entry; region?: RegionFile }[],
                               metric: CompareMetric, year?: number) {
  const isCount = COUNT_METRICS.includes(metric);
  const usedMonths: Month[] = [];
  const incomplete: { id: string; season_window: { from: string; to: string } }[] = [];
  const rows = items.map(({ country, entry, region }) => {
    let raw: number | null;
    let window: { from: string; to: string } | null = null;
    let range: ReturnType<typeof backcastRange> | null = null;
    let reason: string | null = null;
    if (metric === "season_total") {
      if (!region || year === undefined) throw new Error("season_total needs a year");
      window = seasonWindow(entry.season_start_month, year);
      raw = region.years.find((y) => y.season_year === year)?.total ?? null;
      if (raw === null) {
        reason = incompleteReason(region, window);
        incomplete.push({ id: entry.id, season_window: window });
      } else if (entry.mode === "harmonized") {
        const ms = monthsIn(region, window);
        usedMonths.push(...ms);
        range = backcastRange(ms);
      }
    } else {
      raw = entry[metric] ?? null;
    }
    // Count metrics of relative regions are raw MODIS counts: never put them in `value`.
    const relCount = isCount && entry.mode === "relative";
    return dropNulls({
      id: entry.id, name: clean(entry.name), country: country.toUpperCase(), mode: entry.mode,
      value: relCount ? null : raw, value_modis: relCount ? raw : null,
      value_lo: range?.lo ?? null, value_hi: range?.hi ?? null, backcast_months: range?.backcast_months ?? null,
      season_window: window, incomplete_season: reason,
      view_url: viewUrl(country, entry.id),
    }) as { id: string; mode: string; value?: number; value_modis?: number; value_lo?: number; value_hi?: number;
            backcast_months?: number; season_window?: { from: string; to: string }; incomplete_season?: string;
            view_url: string };
  });
  const relative = rows.filter((r) => r.mode === "relative").map((r) => r.id);
  // A region without a season_total for the year cannot be placed in a ranking.
  const ranking_allowed = !(isCount && relative.length) && !incomplete.length;
  const caveats: Caveat[] = [];
  if (isCount && relative.length) {
    caveats.push({
      code: "relative_mode",
      message: `Regions ${relative.join(", ")} are in relative mode: value is null and value_modis is a raw MODIS count on a different scale. No absolute ranking is given.`,
    });
  }
  if (year !== undefined) caveats.push(...incompleteCaveat(incomplete, year));
  if (isCount) {
    caveats.push(DETECTIONS);
    if (ranking_allowed) rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  }
  caveats.push(...backcastCaveats("harmonized", usedMonths, "these season totals",
                                  "value_lo to value_hi on rows with backcast_months > 0"));
  caveats.push(...windowsCaveat(rows));
  return { metric, year: year ?? null, ranking_allowed, rows, caveats };
}

// ---------- aggregate ----------

/** Totals over a period for one or more regions, plus the top months of their sum. */
export function aggregate(regions: RegionFile[], p: { from: string; to: string; top: number }, period: Period) {
  if (p.from > p.to) throw new Error("from must not be after to");
  const ids = regions.map((r) => r.id);
  for (const [country, child] of [["GR", /^EL\d\d$/], ["AR", /^\d\d$/]] as const) {
    if (ids.includes(country) && ids.some((i) => child.test(i))) {
      throw new Error(`${country} already contains its regions; adding both would double count. Use either the country or its regions.`);
    }
  }
  const caveats: Caveat[] = [];
  const from = p.from < period.start ? period.start : p.from;
  const to = p.to > period.end ? period.end : p.to;
  if (from !== p.from || to !== p.to) caveats.push(outOfCoverage(`Part of the requested range ${p.from} to ${p.to}`, period));
  const allHarm = regions.every((r) => r.mode === "harmonized");
  const series: Series = allHarm ? "harm" : "modis";
  if (!allHarm) {
    caveats.push({
      code: "relative_mode",
      message: `${regions.filter((r) => r.mode === "relative").map((r) => r.id).join(", ")} in relative mode, so all totals use raw MODIS counts (not VIIRS-equivalent).`,
    });
  }
  const byMonth = new Map<string, number>();
  const used: Month[] = [];
  const rows = regions.map((r) => {
    const ms = (r.months as Month[]).filter((m) => m.ym >= from && m.ym <= to);
    used.push(...ms);
    let total = 0;
    for (const m of ms) {
      const v = (series === "harm" ? m.harm : m.modis) ?? 0;
      total += v;
      byMonth.set(m.ym, (byMonth.get(m.ym) ?? 0) + v);
    }
    caveats.push(...caveatsFor(series === "harm" ? "harmonized" : "relative", ms).filter((c) => c.code === "outage"));
    const b = series === "harm" ? backcastRange(ms) : null;
    return { id: r.id, name: clean(r.name), mode: r.mode, total: r1(total) as number, n_months: ms.length,
             ...dropNulls({ backcast_months: b?.backcast_months ?? null, total_lo: b?.lo ?? null, total_hi: b?.hi ?? null }),
             anomaly_months: ms.filter((m) => m.anom).map((m) => m.ym) };
  });
  // Back-cast months of all regions together; the overall range sums the per-region ranges.
  caveats.push(...backcastCaveats(series === "harm" ? "harmonized" : "relative", used, "the totals",
                                  "total_lo to total_hi overall and per region"));
  const withRange = rows.some((r) => r.total_lo !== undefined);
  const sumOf = (k: "total_lo" | "total_hi") => r1(rows.reduce((a, r) => a + (r[k] ?? r.total), 0)) as number;
  const top_months = [...byMonth.entries()].sort((a, b) => b[1] - a[1]).slice(0, p.top)
    .map(([ym, total]) => ({ ym, total: r1(total) as number }));
  const seen = new Set<string>();
  const uniq = [...caveats, DETECTIONS].filter((c) => (seen.has(c.message) ? false : (seen.add(c.message), true)));
  return { series, from, to, total: r1(rows.reduce((a, r) => a + r.total, 0)) as number,
           ...(withRange ? { total_lo: sumOf("total_lo"), total_hi: sumOf("total_hi") } : {}),
           regions: rows, top_months, caveats: uniq };
}

// ---------- rank_regions ----------

export const RANK_METRICS = ["annual_mean", "density_per_1000km2", "season_total", "season_length", "loyo_mdape_pct"] as const;
export type RankMetric = (typeof RANK_METRICS)[number];

/** Sorted list over many regions. Count metrics rank harmonized regions only; relative ones are listed apart. */
export function rankRegions(items: { country: CountryCode; entry: Entry; region?: RegionFile }[], metric: RankMetric,
                            p: { year?: number; top: number; order: "desc" | "asc" }) {
  if (metric === "season_total" && p.year === undefined) throw new Error("season_total needs a year");
  const isCount = COUNT_METRICS.includes(metric);
  const value = ({ entry, region }: (typeof items)[number]): number | null =>
    metric === "season_total"
      ? (region?.years.find((y) => y.season_year === p.year)?.total ?? null)
      : ((entry[metric] as number | null | undefined) ?? null);
  const windowOf = (it: (typeof items)[number]) => seasonWindow(it.entry.season_start_month, p.year!);
  const row = (it: (typeof items)[number]) => ({
    id: it.entry.id, name: clean(it.entry.name), country: it.country.toUpperCase(), level: it.entry.level,
    mode: it.entry.mode,
    ...(metric === "season_total" ? { season_window: windowOf(it) } : {}),
    view_url: viewUrl(it.country, it.entry.id),
  });
  /** season_total of a harmonized region: back-cast months of its window and the value range. */
  const range = (it: (typeof items)[number]) => {
    const b = metric === "season_total" && it.entry.mode === "harmonized" && it.region
      ? backcastRange(monthsIn(it.region, windowOf(it))) : null;
    return dropNulls({ backcast_months: b?.backcast_months ?? null, value_lo: b?.lo ?? null, value_hi: b?.hi ?? null });
  };
  const rankable = items.filter((it) => !(isCount && it.entry.mode === "relative"));
  const sign = p.order === "desc" ? -1 : 1;
  const ranked = rankable
    .filter((it) => value(it) !== null)
    .map((it) => ({ ...row(it), value: value(it) as number, ...range(it) }))
    .sort((a, b) => sign * (a.value - b.value))
    .slice(0, p.top)
    .map((r, i) => ({ rank: i + 1, ...r }));
  const excluded = items.filter((it) => isCount && it.entry.mode === "relative")
    .map((it) => ({ ...row(it), value_modis: value(it) }));
  // season_total: regions whose season year is not complete in the data are listed, not silently dropped.
  const incomplete_season = metric === "season_total"
    ? items.filter((it) => value(it) === null).map((it) => ({
        id: it.entry.id, name: clean(it.entry.name), mode: it.entry.mode, season_window: windowOf(it),
        reason: it.region ? incompleteReason(it.region, windowOf(it)) : "season year not complete in coverage",
      }))
    : [];
  const caveats: Caveat[] = [];
  if (excluded.length) {
    caveats.push({
      code: "relative_mode",
      message: `Not ranked: ${excluded.map((r) => r.id).join(", ")} (relative mode, raw MODIS counts on a different scale). They are listed in excluded_relative.`,
    });
  }
  if (p.year !== undefined) caveats.push(...incompleteCaveat(incomplete_season, p.year));
  if (isCount) caveats.push(DETECTIONS);
  if (metric === "season_total") {
    const used = ranked.flatMap((r) => {
      const it = rankable.find((x) => x.entry.id === r.id);
      return it?.region && it.entry.mode === "harmonized" ? monthsIn(it.region, windowOf(it)) : [];
    });
    caveats.push(...backcastCaveats("harmonized", used, "the ranked season totals",
      "value_lo to value_hi on rows with backcast_months > 0",
      "Ranks use the central value, so overlapping ranges leave the order uncertain."));
  }
  caveats.push(...windowsCaveat(ranked));
  if (metric === "annual_mean" || metric === "season_total") {
    caveats.push({ code: "size_bias", message: "Absolute counts favour large regions; use density_per_1000km2 to compare regions of different size." });
  }
  return { metric, year: p.year ?? null, order: p.order, ranked,
           ...(metric === "season_total" ? { incomplete_season } : {}),
           excluded_relative: excluded, caveats };
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
export function regionSummary(country: CountryCode, entry: Entry, region: RegionFile) {
  const c = region.summary;
  return {
    id: entry.id, name: clean(entry.name), country: country.toUpperCase(), level: entry.level, mode: entry.mode,
    climatology: { onset: c.onset, peak_month: c.peak_month, end: c.end, season_length: c.season_length,
                   bimodal: c.bimodal, season_start_month: c.season_start_month },
    ...annualMeanFields(entry),
    last_season_years: region.years.slice(-3).map((y) => ({ season_year: y.season_year, total: y.total, peak_month: y.peak_month })),
    season_totals_of: seriesOf(entry.mode),
    caveats: [...caveatsFor(entry.mode, []),
              ...backcastCaveats(entry.mode, region.months as Month[], "the climatology and annual_mean (over all season years)", null)],
    view_url: viewUrl(country, entry.id),
    data_url: dataUrl(country, entry.id, "json"),
    ...hotspotLinks(country, entry.id),
  };
}

// ---------- get_validation ----------

type Scores = { bias_pct: number | null; r: number | null; rmse_log1p: number | null; n_months: number };
type SeasonScores = { peak_hit_rate: number | null; peak_hits: number; onset_mad_months: number | null;
                      end_mad_months: number | null; length_mad_months: number | null };
interface RegionValidation {
  loyo: { years: number[]; annual_mdape_pct: number | null; annual_err_pct: Record<string, number | null>;
          monthly: Scores; season: { season_years: number[]; harm: SeasonScores; modis_raw: SeasonScores } };
  time_split: { fit: string; test: string; annual_err_pct: Record<string, number | null>;
                annual_mdape_pct: number | null; monthly: Scores };
  fit_window_gap_pct: number | null;
  ratio_trend: Record<"D" | "N", { slope_pct_per_year: number; ratio_by_year: Record<string, number> } | null>;
  mode: RegionFile["mode"];
  mode_reasons: string[];
}
export interface CountryValidation {
  static_filter: object;
  assignment: object;
  regions: Record<string, unknown>;
}

export const MODE_RULE =
  "A region is 'relative' when its leave-one-year-out median absolute annual error is above 25 %, or when the harmonized series misses the VIIRS peak month in more than one more held-out season year than raw MODIS (peak-month part amended 14 Nov 2026 after seeing results).";

function absSummary(errs: Record<string, number | null>) {
  const a = Object.values(errs).filter((x): x is number => x !== null).map(Math.abs).sort((x, y) => x - y);
  if (!a.length) return { min: null, median: null, max: null };
  const mid = a.length / 2;
  const median = a.length % 2 ? a[Math.floor(mid)] : (a[mid - 1] + a[mid]) / 2;
  return { min: a[0], median: r1(median), max: a[a.length - 1] };
}

/** Validation of one region; for a country region also a table of all its regions. */
export function validationFor(region: RegionFile, country?: { validation: CountryValidation; index: IndexFile }) {
  const v = region.validation as unknown as RegionValidation;
  const cc = countryOf(region.id)!;
  const out = {
    region_id: region.id, name: clean(region.name), mode: v.mode, mode_reasons: v.mode_reasons, rule: MODE_RULE,
    loyo: {
      method: "Leave one year out over 2012-2019: refit without the year, predict it from MODIS, compare with VIIRS.",
      years: v.loyo.years, annual_mdape_pct: v.loyo.annual_mdape_pct, annual_err_pct: v.loyo.annual_err_pct,
      abs_err_summary: absSummary(v.loyo.annual_err_pct), monthly: v.loyo.monthly,
      peak_month: { season_years: v.loyo.season.season_years, harmonized: v.loyo.season.harm, raw_modis: v.loyo.season.modis_raw },
    },
    time_split: { ...v.time_split, abs_err_summary: absSummary(v.time_split.annual_err_pct) },
    fit_window_gap_pct: v.fit_window_gap_pct,
    ratio_trend_pct_per_year: { day: v.ratio_trend.D?.slope_pct_per_year ?? null, night: v.ratio_trend.N?.slope_pct_per_year ?? null },
    ratio_by_year: { day: v.ratio_trend.D?.ratio_by_year ?? null, night: v.ratio_trend.N?.ratio_by_year ?? null },
    band: region.band,
    band_note: "harm_lo / harm_hi of back-cast months are the modelled value times q_lo / q_hi of the calendar month (10th / 90th percentile of LOYO obs/pred, pooled by season).",
    caveats: caveatsFor(region.mode, []),
    view_url: viewUrl(cc, region.id),
    data_url: `${PUBLIC_URL}data/v1/${cc}/validation.json`,
  };
  if (!country || region.level !== "country") {
    return { ...out, static_filter: undefined, assignment: undefined, regions: undefined };
  }
  const regions = country.index.regions.filter((r) => r.level !== "country").map((r) => {
    const rv = country.validation.regions[r.id] as RegionValidation | undefined;
    return {
      id: r.id, name: clean(r.name), mode: r.mode,
      loyo_mdape_pct: rv?.loyo.annual_mdape_pct ?? null,
      time_split_mdape_pct: rv?.time_split.annual_mdape_pct ?? null,
      peak_hit_rate: rv?.loyo.season.harm.peak_hit_rate ?? null,
      peak_hit_rate_raw: rv?.loyo.season.modis_raw.peak_hit_rate ?? null,
      fit_window_gap_pct: rv?.fit_window_gap_pct ?? null,
    };
  });
  return { ...out, static_filter: country.validation.static_filter, assignment: country.validation.assignment, regions };
}

// ---------- compact caveats ----------

/** caveats: "codes" mode: replace the caveat texts by their codes; get_methodology topic "caveats" explains them. */
export function compactCaveats<T extends { caveats?: Caveat[] }>(result: T) {
  const { caveats, ...rest } = result;
  return { ...rest, caveat_codes: [...new Set((caveats ?? []).map((c) => c.code))],
           caveat_help: "get_methodology topic 'caveats' explains each code" };
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
  caveats:
    "Caveat codes: coverage = data cover 2000-11 to 2025-12, S-NPP stopped 2 Nov 2026, no NOAA-20 splice, so nothing after Dec 2025. out_of_coverage = part of the request was outside that range and was clipped. relative_mode = the region failed validation; harm is null and counts are raw MODIS, not comparable with harmonized regions. backcast = months before 2012 are modelled from MODIS; quote harm_lo..harm_hi, or for sums total_lo..total_hi / value_lo..value_hi (season totals and climatology before 2012 are modelled too). backcast_terra = Nov 2000 to Jun 2002 use Terra only with a chained factor; wider uncertainty. outage = a known MODIS (Aqua) data gap of 3 or more days affects a MODIS-based value. detections_not_fires = counts are satellite detections, not fires or burned area. size_bias = absolute counts favour large regions; use density_per_1000km2.",
  limits:
    "Detections are not fires or burned area. Back-cast months (before 2012) are modelled. Factors are constant per region-month and do not follow land-cover change. acq_date is UTC, so some Argentine night detections fall on the next day. Known satellite outages are listed manually (Aqua Aug-Sep 2020). Series ends Dec 2025; S-NPP ended 2 Nov 2026 and the NOAA-20 splice is not done.",
};
