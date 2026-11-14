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
}

export interface IndexFile {
  schema_version: string;
  generated_at: string;
  country: string;
  country_name: string;
  period: { start: string; end: string };
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
  outage_days: number;
  outage: boolean;
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

/** Value the anomaly baseline is computed on: harm in harmonized mode, modis in relative mode. */
export function baselineValue(rec: MonthRecord, mode: Mode): number | null {
  return mode === "harmonized" ? rec.harm : rec.modis;
}
