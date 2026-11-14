// Region report as Markdown, built in the browser from the loaded index.json and regions/{id}.json.
// DOM-free so it can be tested. Every number comes from the data files; nothing is recomputed
// except ratios and month lengths.
import { baselineValue, detectionDaysText, outageNote, type IndexFile, type MonthRecord, type RegionFile } from "./contract.ts";

/** Same text as CITATION.cff (keep the two in step). */
export const CITATION =
  'Mikeska, P., Kadlec, V. (2026). Burning calendar: harmonized MODIS + VIIRS fire hotspots for Greece and Argentina (v1, method v1-region-month-dn-loyo). https://burning-calendar.vercel.app. Source detections: NASA FIRMS, MODIS C6.1 and VIIRS S-NPP 375 m (https://earthdata.nasa.gov/firms).';

/** Rows in the monthly table: the date range, or the last 12 months without one; capped. */
export const MAX_TABLE_ROWS = 120;

interface SourceBlock {
  firms?: { product?: string; downloaded?: string[]; modis?: { instrument?: string }; viirs?: { instrument?: string }; api_2026?: { product?: string } };
  filters?: { type?: string; static_sources?: string };
  boundaries?: { name?: string };
  area_crs?: string;
}

export interface ReportInput {
  index: IndexFile;
  region: RegionFile;
  /** Month compared with its median. */
  ym: string;
  from: string | null;
  to: string | null;
  /** Absolute deep link to this view. */
  viewUrl: string;
  /** Absolute URL of the region's monthly CSV. */
  csvUrl: string;
  /** ISO date of the download. */
  today: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const n1 = (x: number | null | undefined) => (x == null ? "n/a" : x >= 100 ? Math.round(x).toLocaleString("en") : String(Math.round(x * 10) / 10));
const pct = (x: number | null | undefined) => (x == null ? "n/a" : `${x} %`);

function monthTable(region: RegionFile, from: string | null, to: string | null): { rows: MonthRecord[]; label: string; cut: boolean } {
  const all = region.months;
  const inRange = from || to ? all.filter((m) => (!from || m.ym >= from) && (!to || m.ym <= to)) : all.slice(-12);
  const label = from || to ? `${from ?? all[0].ym} to ${to ?? all[all.length - 1].ym}` : "last 12 months of the series";
  return { rows: inRange.slice(0, MAX_TABLE_ROWS), label, cut: inRange.length > MAX_TABLE_ROWS };
}

export function buildReport(p: ReportInput): string {
  const { index, region, ym } = p;
  const entry = index.regions.find((r) => r.id === region.id);
  const src = (index as unknown as { source?: SourceBlock }).source ?? {};
  const harmonized = region.mode === "harmonized";
  const s = region.summary;
  const v = region.validation as {
    loyo?: { annual_mdape_pct?: number | null; years?: number[] };
    time_split?: { annual_mdape_pct?: number | null; fit?: string; test?: string };
    mode_reasons?: string[];
  };
  const out: string[] = [];
  const push = (...l: string[]) => out.push(...l);

  push(`# Burning calendar: ${region.name} (${region.id})`, "");
  push(`Report downloaded ${p.today} from ${p.viewUrl}`, "");

  push("## Region", "");
  push(`- Country: ${index.country_name}; level: ${region.level}; mode: **${region.mode}**`);
  if (entry?.area_km2) push(`- Area: ${n1(entry.area_km2)} km² (${src.area_crs ?? "equal-area CRS"})`);
  push(`- Critical period: ${MONTHS[s.onset - 1]} to ${MONTHS[s.end - 1]}, peak ${MONTHS[s.peak_month - 1]}${s.bimodal ? ", bimodal" : ""} (climatology of complete years to 2025)`);
  if (entry && harmonized && entry.annual_mean != null) {
    push(`- Mean per season year: ${n1(entry.annual_mean)} VIIRS-equivalent detections, ${entry.density_per_1000km2 ?? "n/a"} per 1000 km² (includes the modelled years before Feb 2012)`);
  }
  if (!harmonized) {
    push(`- Relative mode: harmonization failed validation here (${(v.mode_reasons ?? []).join("; ") || "see validation"}). Counts are raw MODIS and must not be compared with harmonized regions.`);
  }
  push("");

  const rec = region.months.find((m) => m.ym === ym);
  if (rec) {
    const value = baselineValue(rec, region.mode);
    const usesViirs = harmonized && rec.src === "observed";
    push(`## ${ym} against the median of the preceding years`, "");
    push(`| field | value |`, `|---|---|`);
    push(`| ${harmonized ? "VIIRS-equivalent" : "raw MODIS"} detections | ${n1(value)} |`);
    push(`| source of the value | ${rec.src}${rec.provisional ? ", provisional (FIRMS near real-time)" : ""} |`);
    if (harmonized && rec.src !== "observed") push(`| likely range (10th-90th percentile of the back-cast check) | ${n1(rec.harm_lo)} to ${n1(rec.harm_hi)} |`);
    push(`| baseline years | ${rec.baseline_years ?? "n/a"} |`);
    push(`| baseline median / 90th percentile | ${n1(rec.baseline_median)} / ${n1(rec.baseline_p90)} |`);
    // A ratio on a median under 5 swings with one fire (burncal-0kc); give it only above that.
    if (value != null && rec.baseline_median != null && rec.baseline_median >= 5) push(`| ratio to the median | ${n1(value / rec.baseline_median)}x |`);
    push(`| percentile rank in the baseline (0-100, not a percent change) | ${rec.anom_pct ?? "n/a"} |`);
    push(`| anomaly (above the 90th percentile) | ${rec.anom ? "yes" : "no"}${rec.anom && (value ?? 0) < 20 ? " (fewer than 20 detections: one fire can cross the threshold)" : ""} |`);
    const days = detectionDaysText(rec, usesViirs);
    if (days) push(`| days with a detection | ${days} |`);
    const gap = outageNote(rec, usesViirs);
    if (gap) push(`| known satellite gap | ${gap}, the count may be too low |`);
    push(`| raw counts MODIS / VIIRS | ${rec.modis ?? "n/a"} / ${rec.viirs ?? "n/a"} |`, "");
  }

  const t = monthTable(region, p.from, p.to);
  push(`## Monthly values, ${t.label}`, "");
  push(harmonized ? "| month | harmonized | range | source | MODIS | VIIRS | anomaly |" : "| month | MODIS | VIIRS | anomaly |");
  push(harmonized ? "|---|---|---|---|---|---|---|" : "|---|---|---|---|");
  for (const m of t.rows) {
    const flag = `${m.anom ? "yes" : ""}${m.provisional ? " (provisional)" : ""}`.trim();
    push(harmonized
      ? `| ${m.ym} | ${n1(m.harm)} | ${m.src === "observed" ? "" : `${n1(m.harm_lo)}-${n1(m.harm_hi)}`} | ${m.src} | ${m.modis ?? ""} | ${m.viirs ?? ""} | ${flag} |`
      : `| ${m.ym} | ${m.modis ?? ""} | ${m.viirs ?? ""} | ${flag} |`);
  }
  if (t.cut) push("", `Table cut at ${MAX_TABLE_ROWS} months; the full series is in ${p.csvUrl}`);
  push("");

  push("## Validation of the harmonization in this region", "");
  push(`- Leave-one-year-out ${v.loyo?.years ? `${v.loyo.years[0]}-${v.loyo.years[v.loyo.years.length - 1]}` : ""}: median absolute error of annual totals ${pct(v.loyo?.annual_mdape_pct)}`);
  push(`- Time split (fit ${v.time_split?.fit ?? "2012-2019"}, test ${v.time_split?.test ?? "2020-2025"}): ${pct(v.time_split?.annual_mdape_pct)}`);
  push(`- Peak month hit rate, harmonized / raw MODIS: ${entry?.peak_hit_rate ?? "n/a"} / ${entry?.peak_hit_rate_raw ?? "n/a"}`, "");

  push("## Data and method", "");
  push(`- Unit: ${index.units}`);
  push(`- Coverage: ${index.period.start} to ${index.period.end}${index.period.provisional_from ? `; from ${index.period.provisional_from} built from FIRMS near real-time data (provisional)` : ""}`);
  push(`- Method version: ${index.method_version}. ${index.notes}`);
  push(`- Sources: ${src.firms?.product ?? "NASA FIRMS"}; ${src.firms?.modis?.instrument ?? "MODIS C6.1"}; ${src.firms?.viirs?.instrument ?? "VIIRS S-NPP 375 m"}; downloaded ${(src.firms?.downloaded ?? []).join(", ") || "n/a"}${src.firms?.api_2026?.product ? `; 2026 from the ${src.firms.api_2026.product}` : ""}`);
  if (src.filters) push(`- Filters: ${src.filters.type ?? ""}; ${src.filters.static_sources ?? ""}`);
  if (src.boundaries?.name) push(`- Boundaries: ${src.boundaries.name}`);
  push(`- Monthly CSV: ${p.csvUrl}`, "");

  push("## Limits", "");
  push("- Counts are satellite active fire detections, not fires and not burned area.");
  push("- Nov 2000 to Jan 2012 are back-cast from MODIS (FIRMS S-NPP starts 20 Jan 2012); quote them with their range.");
  push("- Factors are constant per region, month and day/night (fit Feb 2012 to Dec 2019) and do not follow land-cover change or orbit drift.");
  push("- Dates are UTC; some night detections in Argentina fall on the next local day.");
  push("- VIIRS S-NPP stopped on 2 Nov 2026; the NOAA-20 splice is not done.", "");

  push("## Cite", "", CITATION, "");
  return out.join("\n");
}

export function reportFileName(country: string, region: string, ym: string): string {
  return `burning-calendar_${country}_${region}_report_${ym}.md`;
}
