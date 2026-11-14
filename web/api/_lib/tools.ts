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
import { regionAt, type RegionCollection } from "../../src/lib/geo.ts";
import { serializeState } from "../../src/lib/url-state.ts";

export const PUBLIC_URL = "https://burning-calendar.vercel.app/";
export const MAX_MONTHS = 120;

type Month = MonthRecord & {
  baseline_median?: number | null;
  baseline_p90?: number | null;
  baseline_years?: string | null;
};

export interface Caveat {
  code: "relative_mode" | "backcast" | "backcast_terra" | "outage" | "detections_not_fires";
  message: string;
}

const DETECTIONS: Caveat = {
  code: "detections_not_fires",
  message: "Counts are satellite active fire detections, not fires or burned area; one fire can give many detections.",
};

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
  // data/outages.csv lists MODIS (Aqua) gaps only, so an outage matters only where the value comes from MODIS.
  const outages = months.filter((m) => m.outage && (mode === "relative" || m.src !== "observed")).map((m) => m.ym);
  if (outages.length) {
    out.push({ code: "outage", message: `Known MODIS data gaps of 3 or more days in: ${outages.join(", ")}; counts there may be low.` });
  }
  out.push(DETECTIONS);
  return out;
}

const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

// ---------- search_regions ----------

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
      annual_mean: r.annual_mean, annual_mean_of: r.annual_mean_of, loyo_mdape_pct: r.loyo_mdape_pct,
      view_url: viewUrl(country, r.id),
    }));
  return { count: regions.length, regions };
}

// ---------- get_region_series ----------

export function regionSeries(region: RegionFile, p: { from: string; to: string; aggregate: "month" | "year" }) {
  const country = countryOf(region.id)!;
  if (p.from > p.to) throw new Error("from must not be after to");
  const months = (region.months as Month[]).filter((m) => m.ym >= p.from && m.ym <= p.to);
  if (p.aggregate === "month" && months.length > MAX_MONTHS) {
    throw new Error(`Range has ${months.length} months; at most ${MAX_MONTHS} monthly records per call. Use aggregate "year" or a shorter range.`);
  }
  const records = p.aggregate === "month"
    ? months.map((m) => ({
        ym: m.ym, modis: m.modis, viirs: m.viirs, harm: r1(m.harm), harm_lo: r1(m.harm_lo), harm_hi: r1(m.harm_hi),
        src: m.src, anom_pct: m.anom_pct, anom: m.anom, outage: m.outage,
      }))
    : yearly(months, region.mode);
  return {
    region_id: region.id, name: clean(region.name), mode: region.mode, unit: region.units,
    from: p.from, to: p.to, aggregate: p.aggregate,
    caveats: caveatsFor(region.mode, months),
    records,
    view_url: viewUrl(country, region.id, p.from, p.to),
    data_url: dataUrl(country, region.id, "json"),
    csv_url: dataUrl(country, region.id, "csv"),
  };
}

function yearly(months: Month[], mode: RegionFile["mode"]) {
  const by = new Map<number, Month[]>();
  for (const m of months) {
    const y = Number(m.ym.slice(0, 4));
    by.set(y, [...(by.get(y) ?? []), m]);
  }
  return [...by.entries()].map(([year, ms]) => ({
    year,
    n_months: ms.length,
    modis: ms.reduce((a, m) => a + m.modis, 0),
    viirs: ms.every((m) => m.viirs !== null) ? ms.reduce((a, m) => a + (m.viirs ?? 0), 0) : null,
    harm: mode === "harmonized" ? r1(ms.reduce((a, m) => a + (m.harm ?? 0), 0)) : null,
    backcast_months: ms.filter((m) => m.src !== "observed").length,
    anomaly_months: ms.filter((m) => m.anom).map((m) => m.ym),
  }));
}

// ---------- get_season_calendar ----------

export function seasonCalendar(region: RegionFile, year?: number) {
  const country = countryOf(region.id)!;
  const loyo = (region.validation as { loyo?: { annual_mdape_pct?: number | null } }).loyo;
  return {
    region_id: region.id, name: clean(region.name), mode: region.mode,
    metrics_on: region.mode === "harmonized" ? "harm" : "modis",
    climatology: region.summary,
    years: year === undefined ? region.years : region.years.filter((y) => y.season_year === year),
    loyo_mdape_pct: loyo?.annual_mdape_pct ?? null,
    notes: "Months are 1-12. onset/end: months where the cumulative season count passes 10 % and 90 %. A season year starts at season_start_month and is labelled with the calendar year holding most of its months.",
    caveats: caveatsFor(region.mode, []),
    view_url: viewUrl(country, region.id),
  };
}

// ---------- get_anomalies ----------

export function anomaliesFor(region: RegionFile, year: number) {
  const country = countryOf(region.id)!;
  const series: Series = region.mode === "harmonized" ? "harm" : "modis";
  const months = (region.months as Month[]).filter((m) => m.ym.startsWith(`${year}-`));
  const rows = months.map((m) => {
    const value = series === "harm" ? m.harm : m.modis;
    const med = m.baseline_median ?? null;
    return {
      ym: m.ym, value: r1(value), src: m.src, anom_pct: m.anom_pct, anom: m.anom,
      baseline_median: med, baseline_p90: m.baseline_p90 ?? null, baseline_years: m.baseline_years ?? null,
      ratio_to_median: value !== null && med ? Math.round((value / med) * 10) / 10 : null,
      outage: m.outage,
    };
  });
  return {
    region_id: region.id, name: clean(region.name), mode: region.mode, series, year,
    definition: "anom_pct: percentile rank of the month among the same month of the preceding 10 years (2002-2011 without the target year before 2012). anom: above the baseline 90th percentile.",
    flagged: rows.filter((r) => r.anom).map((r) => r.ym),
    months: rows,
    caveats: caveatsFor(region.mode, months),
    view_url: viewUrl(country, region.id, `${year}-01`, `${year}-12`, series),
  };
}

// ---------- compare_regions ----------

export type CompareMetric = "annual_mean" | "season_total" | "peak_month" | "onset" | "end" | "season_length" | "loyo_mdape_pct";
const COUNT_METRICS: CompareMetric[] = ["annual_mean", "season_total"];

export function compareRegions(items: { country: CountryCode; entry: IndexRegion; region?: RegionFile }[],
                               metric: CompareMetric, year?: number) {
  const rows = items.map(({ country, entry, region }) => {
    let value: number | null;
    if (metric === "season_total") {
      if (!region || year === undefined) throw new Error("season_total needs a year");
      value = region.years.find((y) => y.season_year === year)?.total ?? null;
    } else {
      value = entry[metric] ?? null;
    }
    return { id: entry.id, name: clean(entry.name), country: country.toUpperCase(), mode: entry.mode,
             value, view_url: viewUrl(country, entry.id) };
  });
  const isCount = COUNT_METRICS.includes(metric);
  const anyRelative = rows.some((r) => r.mode === "relative");
  const ranking_allowed = !(isCount && anyRelative);
  const caveats: Caveat[] = [];
  if (!ranking_allowed) {
    caveats.push({
      code: "relative_mode",
      message: `Regions ${rows.filter((r) => r.mode === "relative").map((r) => r.id).join(", ")} are in relative mode (MODIS counts only). Their counts are on a different scale; no absolute ranking is given.`,
    });
  }
  if (isCount) {
    caveats.push(DETECTIONS);
    if (ranking_allowed) rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  }
  return { metric, year: year ?? null, ranking_allowed, rows, caveats };
}

// ---------- find_region_at ----------

export function findRegionAt(geo: Record<CountryCode, RegionCollection>, idx: Record<CountryCode, IndexFile>,
                             lat: number, lon: number) {
  for (const country of ["gr", "ar"] as const) {
    const f = regionAt(geo[country], lon, lat);
    if (!f) continue;
    const entry = idx[country].regions.find((r) => r.id === f.properties.id);
    if (!entry) continue;
    return {
      found: true as const, id: entry.id, name: clean(entry.name), country: country.toUpperCase(),
      level: entry.level, mode: entry.mode, peak_month: entry.peak_month, view_url: viewUrl(country, entry.id),
    };
  }
  return { found: false as const };
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
