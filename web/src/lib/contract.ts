// Types for the static JSON the pipeline writes to public/data/v1/{gr,ar}/.
// Source of truth: docs/wiki/data-contract.md. DOM-free: shared with api/mcp.ts.

export type CountryCode = "gr" | "ar";
export type Level = "country" | "nuts2" | "nuts3" | "province" | "department";
export type Mode = "harmonized" | "relative";
export type Src = "observed" | "backcast" | "backcast_terra";
export type FitLevel = "region_month_dn" | "region_season_dn" | "region_dn" | "national_dn";
export type Series = "harm" | "modis" | "viirs";

/** Climatology over the full period, months 1-12. */
export interface Climatology {
  peak_month: number;
  onset: number;
  end: number;
  season_length: number;
  season_start_month: number;
  bimodal: boolean;
}

export interface IndexRegion extends Climatology {
  id: string;
  name: string;
  level: Level;
  parent: string | null;
  mode: Mode;
  annual_mean: number;
  annual_mean_of: "harm" | "modis";
  /** Area of the assignment polygons, EPSG:6933. */
  area_km2?: number;
  /** annual_mean per 1000 km2 per year, same series as annual_mean_of. */
  density_per_1000km2?: number | null;
  loyo_mdape_pct: number | null;
  peak_hit_rate: number | null;
  peak_hit_rate_raw: number | null;
  /** Median absolute annual error, fitted 2012-2019 and tested on 2020-2025. */
  time_split_mdape_pct?: number | null;
  /** Quality note of a harmonized region (null in relative mode); see RegionQuality. */
  quality?: "ok" | "limited" | null;
  worst_heldout_year?: number | null;
  worst_heldout_err_pct?: number | null;
}

/**
 * Quality note of a harmonized region (pipeline/validate.py quality()): "limited" when the 2020-2025 test has a median
 * annual error above 25 % or any held-out year misses VIIRS by more than 50 %. It does not change the mode.
 */
export interface RegionQuality {
  level: "ok" | "limited";
  reasons: string[];
  worst_year: number | null;
  worst_test: "loyo" | "time_split" | null;
  worst_err_pct: number | null;
  time_split_mdape_pct: number | null;
}

export interface IndexFile {
  schema_version: string;
  generated_at: string;
  country: string;
  country_name: string;
  /** provisional_from: first month built partly from FIRMS near real-time data (null when none). */
  period: { start: string; end: string; provisional_from?: string | null };
  units: string;
  fixture: boolean;
  method_version: string;
  notes: string;
  regions: IndexRegion[];
}

export interface MonthRecord {
  ym: string; // "YYYY-MM"
  modis: number;
  viirs: number | null;
  harm: number | null;
  harm_lo: number | null;
  harm_hi: number | null;
  src: Src;
  fit_level: FitLevel | null;
  anom_pct: number | null;
  anom: boolean;
  /** Known MODIS gap days (data/outages.csv). */
  outage_days: number;
  outage: boolean;
  /** Known VIIRS S-NPP gap days; absent in data built before 2026 was added. */
  outage_days_viirs?: number;
  outage_viirs?: boolean;
  /** Built partly from FIRMS near real-time data; may change when standard processing replaces it. */
  provisional?: boolean;
  /** Days of the month with at least one detection after filters (distinct UTC acq_date), per sensor; days_viirs null before 2012. */
  days_modis?: number | null;
  days_viirs?: number | null;
  /** Median of the same calendar month over the baseline years, same series as anom_pct. Null with < 5 values. */
  baseline_median: number | null;
  baseline_p90: number | null;
  /** "2010-2019" or "2002-2011 without 2005". */
  baseline_years: string | null;
}

export interface SeasonYear {
  season_year: number;
  onset: number;
  end: number;
  season_length: number;
  peak_month: number;
  total: number;
}

export interface Factor {
  month: number;
  dn: "D" | "N";
  f: number;
  level: string;
  den_total: number;
  kind: "viirs_over_modis" | "modis_over_terra";
  window: string;
}

export interface BandRow {
  month: number;
  q_lo: number;
  q_hi: number;
}

interface ValidationMonthly {
  bias_pct: number | null;
  r: number | null;
  n_months: number;
}

/** Subset of `regions/{id}.json` -> `validation` the web reads (full object in validation.json). */
export interface RegionValidation {
  loyo?: {
    years: number[];
    annual_mdape_pct: number | null;
    annual_err_pct: Record<string, number | null>;
    monthly?: ValidationMonthly;
    season?: {
      season_years: number[];
      harm?: { peak_hits: number };
      modis_raw?: { peak_hits: number };
    };
  };
  time_split?: {
    fit: string;
    test: string;
    annual_mdape_pct: number | null;
    annual_err_pct: Record<string, number | null>;
    monthly?: ValidationMonthly;
  };
  mode?: Mode;
  /** e.g. "loyo_mdape 32.0 > 25.0". */
  mode_reasons?: string[];
  /** null in relative mode. */
  quality?: RegionQuality | null;
}

/** "in 2025 (2020-2025 test)" / "in 2018 (left out of the fit)": where the worst held-out year comes from. */
export function worstYearText(q: RegionQuality): string {
  return `${q.worst_year} (${q.worst_test === "time_split" ? "2020-2025 test, after the 2012-2019 fit" : "left out of the 2012-2019 fit"})`;
}

export interface RegionFile {
  schema_version: string;
  generated_at: string;
  units: string;
  id: string;
  name: string;
  level: Level;
  parent: string | null;
  mode: Mode;
  summary: Climatology;
  months: MonthRecord[];
  years: SeasonYear[];
  factors: Factor[];
  band: BandRow[];
  validation: Record<string, unknown>;
}

/** Series a region can show: `harm` is null in relative mode. */
export function availableSeries(mode: Mode): Series[] {
  return mode === "harmonized" ? ["harm", "modis", "viirs"] : ["modis", "viirs"];
}

/**
 * Series shown for a region: the user's choice when the mode offers it, else the mode's first.
 * The choice itself is never overwritten, so a relative region does not leave MODIS behind.
 */
export function shownSeries(mode: Mode, chosen: Series): Series {
  const options = availableSeries(mode);
  return options.includes(chosen) ? chosen : options[0];
}

/** Value the anomaly baseline is computed on: harm in harmonized mode, modis in relative mode. */
export function baselineValue(rec: MonthRecord, mode: Mode): number | null {
  return mode === "harmonized" ? rec.harm : rec.modis;
}

/**
 * The known satellite gap behind a shown value, or null: VIIRS S-NPP gaps where the value is
 * observed VIIRS (the viirs series, or harm in observed months), MODIS gaps everywhere else.
 */
export function outageNote(rec: MonthRecord, usesViirs: boolean): string | null {
  if (usesViirs) return rec.outage_viirs ? `known VIIRS S-NPP outage: ${rec.outage_days_viirs} days` : null;
  return rec.outage ? `known MODIS outage: ${rec.outage_days} days` : null;
}

/**
 * "VIIRS saw fire on 18 of 31 days": days with a detection from the sensor behind the shown value
 * (VIIRS for observed harmonized months, MODIS for back-cast and relative-mode months). Null without data.
 */
export function detectionDaysText(rec: MonthRecord, usesViirs: boolean): string | null {
  const days = usesViirs ? rec.days_viirs : rec.days_modis;
  if (days == null) return null;
  const [y, m] = rec.ym.split("-").map(Number);
  const inMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${usesViirs ? "VIIRS" : "MODIS"} saw fire on ${days} of ${inMonth} days`;
}

/** Below this baseline median a ratio swings with one fire ("61x a median of 1"); the web gives the difference instead. */
export const SMALL_MEDIAN = 5;
