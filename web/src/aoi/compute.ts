// Monthly series, anomalies and season metrics for a custom area (AOI) from individual detections.
// A port of the pipeline (pipeline/harmonize.py monthly_counts, model, series, detection_days;
// pipeline/calendar_metrics.py climatology, onset_end, is_bimodal, season_metrics, anomalies;
// pipeline/validate.py raw_start_month), so an AOI that holds exactly one region's detections
// gives that region's months (test: web/test/aoi.test.ts). DOM-free.
//
// Each detection is harmonized with the factors of the NUTS2 region it belongs to (region_id in the
// detection CSV). That is an estimate: the factors were fitted and validated per region, not for an
// arbitrary area inside or across regions.
import type { Climatology, Mode, MonthRecord, RegionFile, SeasonYear, Src } from "../lib/contract.ts";

export const START = "2000-11";
export const AQUA_START = "2002-07";
export const VIIRS_DATA_START = "2012-01";
export const VIIRS_START = "2012-02";
export const CLIM_END = "2025-12";
const ONSET_Q = 0.1;
const END_Q = 0.9;
const BASELINE_FLOOR = 2002;
const BASELINE_N = 10;

/** One row of data/v1/gr/detections/{id}.csv, as the AOI needs it. */
export interface Detection {
  region_id: string;
  sensor: "modis" | "viirs";
  /** Terra, Aqua, or N (S-NPP). */
  satellite: string;
  date: string; // YYYY-MM-DD (UTC)
  dn: "D" | "N";
  lat: number;
  lon: number;
  /** The CSV line as published, for the AOI detections download. */
  line: string;
}

/** Months from start to end inclusive, as "YYYY-MM". */
export function monthRange(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** numpy.percentile with linear interpolation; `sorted` ascending, q in 0-100. */
export function percentile(sorted: number[], q: number): number {
  const pos = ((sorted.length - 1) * q) / 100;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ---------- calendar metrics (calendar_metrics.py) ----------

/** Mean per calendar month (index 0 = Jan) over the months up to climEnd; NaN where a month has no value. */
export function climatology(yms: string[], values: (number | null)[], climEnd = CLIM_END): number[] {
  const sum = new Array(12).fill(0);
  const n = new Array(12).fill(0);
  yms.forEach((ym, i) => {
    const v = values[i];
    if (ym > climEnd || v === null || Number.isNaN(v)) return;
    const m = Number(ym.slice(5, 7)) - 1;
    sum[m] += v;
    n[m] += 1;
  });
  return sum.map((s, i) => (n[i] ? s / n[i] : NaN));
}

const argFirst = (xs: number[], better: (a: number, b: number) => boolean) => {
  let best = -1;
  xs.forEach((x, i) => {
    if (Number.isNaN(x)) return;
    if (best < 0 || better(x, xs[best])) best = i;
  });
  return best;
};

/** values12 ordered from startMonth; returns calendar months (onset, end) and the length, or nulls. */
export function onsetEnd(values12: number[], startMonth: number): [number | null, number | null, number | null] {
  const total = values12.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return [null, null, null];
  let acc = 0;
  let iOn = -1;
  let iEnd = -1;
  values12.forEach((v, i) => {
    acc += v;
    const c = acc / total;
    if (iOn < 0 && c >= ONSET_Q) iOn = i;
    if (iEnd < 0 && c >= END_Q) iEnd = i;
  });
  const toMonth = (i: number) => ((startMonth - 1 + i) % 12) + 1;
  return [toMonth(iOn), toMonth(iEnd), iEnd - iOn + 1];
}

/** Two circular peaks >= 2 months apart, each trough < 50 % of the smaller peak. */
export function isBimodal(clim: number[]): boolean {
  const at = (i: number) => clim[(i + 12) % 12];
  const peaks = [...Array(12).keys()].filter((i) => clim[i] > at(i - 1) && clim[i] >= at(i + 1));
  if (peaks.length < 2) return false;
  peaks.sort((a, b) => clim[b] - clim[a]);
  const a = peaks[0];
  for (const b of peaks.slice(1)) {
    const dist = Math.min((((a - b) % 12) + 12) % 12, (((b - a) % 12) + 12) % 12);
    if (dist < 2) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const arc1 = Math.min(...clim.slice(lo, hi + 1));
    const arc2 = Math.min(...clim.slice(hi), ...clim.slice(0, lo + 1));
    return Math.max(arc1, arc2) < 0.5 * Math.min(clim[a], clim[b]);
  }
  return false;
}

/** Climatology summary and season years (season_metrics). */
export function seasonMetrics(yms: string[], values: number[], startMonth: number): { summary: Climatology; years: SeasonYear[] } {
  const clim = climatology(yms, values);
  const order = [...Array(12).keys()].map((i) => ((startMonth - 1 + i) % 12) + 1);
  const [onset, end, length] = onsetEnd(order.map((m) => clim[m - 1]), startMonth);
  const summary = {
    peak_month: argFirst(clim, (x, b) => x > b) + 1, onset, end, season_length: length,
    season_start_month: startMonth, bimodal: isBimodal(clim),
  } as Climatology;
  const at = new Map(yms.map((ym, i) => [ym, values[i]]));
  const years: SeasonYear[] = [];
  const first = Number(yms[0].slice(0, 4));
  const last = Number(yms[yms.length - 1].slice(0, 4));
  for (let y = first; y <= last; y++) {
    const window = order.map((_, i) => `${y + Math.floor((startMonth - 1 + i) / 12)}-${String(((startMonth - 1 + i) % 12) + 1).padStart(2, "0")}`);
    if (!window.every((ym) => at.has(ym))) continue;
    const v = window.map((ym) => at.get(ym)!);
    const [o, e, l] = onsetEnd(v, startMonth);
    const total = v.reduce((a, b) => a + b, 0);
    years.push({
      season_year: y + (startMonth >= 8 ? 1 : 0), onset: o!, end: e!, season_length: l!,
      peak_month: (total > 0 ? order[argFirst(v, (x, b) => x > b)] : null) as number, total: round1(total),
    });
  }
  return { summary, years };
}

type Anomaly = Pick<MonthRecord, "anom_pct" | "anom" | "baseline_median" | "baseline_p90" | "baseline_years">;

/** Percentile rank among the same month of the preceding 10 years (anomalies). */
export function anomalies(yms: string[], values: number[]): Anomaly[] {
  const byYm = new Map(yms.map((ym, i) => [ym, values[i]]));
  return yms.map((ym, i) => {
    const y = Number(ym.slice(0, 4));
    const mo = ym.slice(5, 7);
    let baseYears: number[];
    let label: string;
    if (y - BASELINE_N >= BASELINE_FLOOR) {
      baseYears = Array.from({ length: BASELINE_N }, (_, k) => y - BASELINE_N + k);
      label = `${y - BASELINE_N}-${y - 1}`;
    } else {
      const lo = BASELINE_FLOOR;
      const hi = BASELINE_FLOOR + BASELINE_N - 1;
      baseYears = Array.from({ length: BASELINE_N }, (_, k) => lo + k).filter((b) => b !== y);
      label = `${lo}-${hi}` + (y >= lo && y <= hi ? ` without ${y}` : "");
    }
    const base = baseYears.map((b) => byYm.get(`${b}-${mo}`)).filter((v): v is number => v !== undefined && !Number.isNaN(v))
      .sort((a, b) => a - b);
    if (base.length < 5) return { anom_pct: null, anom: false, baseline_median: null, baseline_p90: null, baseline_years: null };
    const x = values[i];
    const p90 = percentile(base, 90);
    const below = base.filter((b) => b < x).length;
    const equal = base.filter((b) => b === x).length;
    return {
      anom_pct: round1((100 * (below + 0.5 * equal)) / base.length),
      anom: x > 0 && x > p90,
      baseline_median: round1(percentile(base, 50)),
      baseline_p90: round1(p90),
      baseline_years: label,
    };
  });
}

// ---------- counts and the harmonized estimate (harmonize.py) ----------

/** Per-region monthly counts: index = month position, 6 columns terra_D, terra_N, aqua_D, aqua_N, viirs_D, viirs_N. */
const COL = { terra_D: 0, terra_N: 1, aqua_D: 2, aqua_N: 3, viirs_D: 4, viirs_N: 5 } as const;

export interface AoiResult {
  file: RegionFile;
  /** Regions whose detections fall in the AOI, with their counts. */
  regions: { id: string; mode: Mode; detections: number }[];
  detections: number;
}

/**
 * Builds a RegionFile-like object for the AOI. `regionFiles` holds the region JSON of every region in
 * `regionIds` (the NUTS2 regions the AOI touches); `reference` gives outages and provisional months.
 */
export function computeAoi(dets: Detection[], regionIds: string[], regionFiles: Map<string, RegionFile>,
                           reference: RegionFile, end: string, name = "Custom area"): AoiResult {
  const yms = monthRange(START, end);
  const pos = new Map(yms.map((ym, i) => [ym, i]));
  const counts = new Map<string, Float64Array>();
  const days = { modis: yms.map(() => new Set<string>()), viirs: yms.map(() => new Set<string>()) };
  const perRegion = new Map<string, number>();
  for (const d of dets) {
    const i = pos.get(d.date.slice(0, 7));
    if (i === undefined) continue;
    let c = counts.get(d.region_id);
    if (!c) counts.set(d.region_id, (c = new Float64Array(yms.length * 6)));
    const src = d.sensor === "viirs" ? "viirs" : d.satellite.toLowerCase() === "terra" ? "terra" : "aqua";
    c[i * 6 + COL[`${src}_${d.dn}` as keyof typeof COL]] += 1;
    days[d.sensor][i].add(d.date);
    perRegion.set(d.region_id, (perRegion.get(d.region_id) ?? 0) + 1);
  }
  const ids = [...new Set([...regionIds, ...counts.keys()])];
  const mode: Mode = ids.every((id) => regionFiles.get(id)?.mode === "harmonized") ? "harmonized" : "relative";

  const modis = new Array(yms.length).fill(0);
  const viirs = new Array(yms.length).fill(0);
  const model = new Array(yms.length).fill(0);
  const lo = new Array(yms.length).fill(0);
  const hi = new Array(yms.length).fill(0);
  for (const [id, c] of counts) {
    const f = regionFiles.get(id);
    const factor = (kind: string, m: number, dn: string) =>
      f?.factors.find((x) => x.kind === kind && x.month === m && x.dn === dn)?.f ?? 0;
    const band = new Map((f?.band ?? []).map((b) => [b.month, b]));
    yms.forEach((ym, i) => {
      const m = Number(ym.slice(5, 7));
      const terraOnly = ym < AQUA_START;
      let regionModel = 0;
      for (const dn of ["D", "N"] as const) {
        const terra = c[i * 6 + COL[`terra_${dn}`]];
        const aqua = c[i * 6 + COL[`aqua_${dn}`]];
        const base = terraOnly ? terra * factor("modis_over_terra", m, dn) : terra + aqua;
        regionModel += base * factor("viirs_over_modis", m, dn);
        modis[i] += terra + aqua;
        viirs[i] += c[i * 6 + COL[`viirs_${dn}`]];
      }
      model[i] += regionModel;
      lo[i] += (band.get(m)?.q_lo ?? 1) * regionModel;
      hi[i] += (band.get(m)?.q_hi ?? 1) * regionModel;
    });
  }

  const refByYm = new Map(reference.months.map((r) => [r.ym, r]));
  const harmonized = mode === "harmonized";
  const harm = yms.map((ym, i) => (ym >= VIIRS_START ? viirs[i] : round1(model[i])));
  const metric = harmonized ? harm : modis.map(Number);
  const an = anomalies(yms, metric);
  // raw_start_month: climatological minimum of the MODIS series up to CLIM_END.
  const start = argFirst(climatology(yms, modis), (x, b) => x < b) + 1;
  const { summary, years } = seasonMetrics(yms, metric, start);

  const months: MonthRecord[] = yms.map((ym, i) => {
    const observed = ym >= VIIRS_START;
    const ref = refByYm.get(ym);
    const src: Src = observed ? "observed" : ym < AQUA_START ? "backcast_terra" : "backcast";
    return {
      ym, modis: modis[i], viirs: ym >= VIIRS_DATA_START ? viirs[i] : null,
      harm: harmonized ? harm[i] : null,
      harm_lo: harmonized && !observed ? round1(lo[i]) : null,
      harm_hi: harmonized && !observed ? round1(hi[i]) : null,
      src, fit_level: null, ...an[i],
      days_modis: days.modis[i].size, days_viirs: ym >= VIIRS_DATA_START ? days.viirs[i].size : null,
      outage_days: ref?.outage_days ?? 0, outage: ref?.outage ?? false,
      outage_days_viirs: ref?.outage_days_viirs ?? 0, outage_viirs: ref?.outage_viirs ?? false,
      provisional: ref?.provisional ?? false,
    };
  });

  const file: RegionFile = {
    schema_version: "1", generated_at: new Date().toISOString(),
    units: harmonized
      ? "VIIRS-equivalent active fire detections per month (S-NPP 375 m scale); estimate with the factors of each detection's NUTS2 region"
      : "raw MODIS Collection 6.1 active fire detections per month (Terra+Aqua, 1 km); the area touches a region in relative mode",
    id: "AOI", name, level: "nuts2", parent: "GR", mode, summary, months, years,
    factors: [], band: [], validation: {},
  };
  return {
    file, detections: dets.length,
    regions: ids.map((id) => ({ id, mode: regionFiles.get(id)?.mode ?? "relative", detections: perRegion.get(id) ?? 0 })),
  };
}
