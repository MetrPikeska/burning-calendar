// Text of the "Now" line under the month card, from GET /api/recent (web/api/recent.ts).

/** The part of the /api/recent answer the line needs. */
export interface RecentBody {
  configured: boolean;
  total: number;
  window: { from: string; to: string; days: number };
  sources_failed?: string[];
  calendar_context: {
    month: number; years: string; median_per_day: number | null;
    nrt_viirs_noaa20_per_day: number | null; ratio_to_median_per_day: number | null;
  } | null;
}

const MONTH = (m: number) => new Date(Date.UTC(2001, m - 1, 15)).toLocaleDateString("en", { month: "short", timeZone: "UTC" });

/** Count of the last days; the NOAA-20 rate against the median only when the API gives a ratio (null after a
 *  failed source, without a full day, or on a baseline month under 20 detections). */
export function nowText(b: RecentBody): string {
  const c = b.calendar_context;
  const rate = c && c.ratio_to_median_per_day != null && c.nrt_viirs_noaa20_per_day != null && c.median_per_day != null
    ? `; NOAA-20 ${c.nrt_viirs_noaa20_per_day}/day, ${c.ratio_to_median_per_day}× the median of ${c.median_per_day}/day for ${MONTH(c.month)} ${c.years} (S-NPP)`
    : "";
  return `<strong>Now</strong>, last ${b.window.days} days: ${b.total.toLocaleString("en")} detections${rate}. `
    + `<span class="now-note">NASA FIRMS near real-time (NOAA-20/21, MODIS), not filtered or harmonized like the calendar; order of magnitude only.</span>`;
}
