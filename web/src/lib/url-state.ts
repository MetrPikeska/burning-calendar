// URL state for deep links, e.g. ?country=gr&region=EL52&from=2007-01&to=2007-12&series=harm
// Format from docs/wiki/agent-access.md; MCP results link here as `view_url`. DOM-free.
import type { CountryCode, Series } from "./contract.ts";

export interface AppState {
  country: CountryCode;
  region: string | null;
  from: string | null; // "YYYY-MM"
  to: string | null; // "YYYY-MM"
  series: Series;
}

export const DEFAULT_STATE: AppState = {
  country: "gr",
  region: null,
  from: null,
  to: null,
  series: "harm",
};

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const REGION = /^[A-Za-z0-9_-]{1,16}$/;
const COUNTRIES: readonly CountryCode[] = ["gr", "ar"];
const SERIES: readonly Series[] = ["harm", "modis", "viirs"];

export function parseState(search: string): AppState {
  const q = new URLSearchParams(search);
  const country = q.get("country")?.toLowerCase();
  const region = q.get("region");
  const from = q.get("from");
  const to = q.get("to");
  const series = q.get("series");
  return {
    country: COUNTRIES.includes(country as CountryCode) ? (country as CountryCode) : DEFAULT_STATE.country,
    region: region && REGION.test(region) ? region : null,
    from: from && YM.test(from) ? from : null,
    to: to && YM.test(to) ? to : null,
    series: SERIES.includes(series as Series) ? (series as Series) : DEFAULT_STATE.series,
  };
}

/** Serialize to a query string ("" or "?..."). Defaults are omitted except country. */
export function serializeState(s: AppState): string {
  const q = new URLSearchParams();
  q.set("country", s.country);
  if (s.region) q.set("region", s.region);
  if (s.from) q.set("from", s.from);
  if (s.to) q.set("to", s.to);
  if (s.series !== DEFAULT_STATE.series) q.set("series", s.series);
  return `?${q.toString()}`;
}
