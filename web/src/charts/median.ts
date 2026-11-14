// Panel "chosen month vs median of the preceding 10 years", from the pipeline's baseline_* fields.
import * as Plot from "@observablehq/plot";
import { baselineValue, detectionDaysText, outageNote, shownSeries, SMALL_MEDIAN, type MonthRecord, type RegionFile, type Series } from "../lib/contract.ts";
import { countTick } from "./ramp.ts";

const monthYear = (ym: string) =>
  new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
const monthOnly = (ym: string) =>
  new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en", { month: "long", timeZone: "UTC" });
/** Whisker colour for the back-cast range: reads on the dark month bar and on the page. */
const RANGE_STROKE = "#f08c1a";
const num = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("en") : n.toFixed(1));

/**
 * Month to show first: the strongest month inside [from, to]; without a range, the strongest of the
 * last 12 months (the latest season's peak, not an off-season December).
 */
export function defaultMonth(region: RegionFile, from: string | null, to: string | null): string {
  const inRange = from || to
    ? region.months.filter((m) => (!from || m.ym >= from) && (!to || m.ym <= to))
    : region.months.slice(-12);
  let best: MonthRecord | null = null;
  for (const m of inRange) {
    const v = baselineValue(m, region.mode) ?? -1;
    if (!best || v > (baselineValue(best, region.mode) ?? -1)) best = m;
  }
  return (best ?? region.months[region.months.length - 1]).ym;
}


/** How the month compares with the median, in words (burncal-0kc). */
export function ratioText(value: number, median: number): string {
  if (median <= 0) return value > 0 ? "above a zero median" : "equal to the median";
  if (median < SMALL_MEDIAN) {
    const d = value - median;
    if (Math.abs(d) < 0.5) return "equal to the median";
    return `<strong>${num(Math.abs(d))} ${d > 0 ? "more" : "fewer"}</strong> than the median`;
  }
  const r = value / median;
  if (r >= 2) return `<strong>${r >= 10 ? Math.round(r) : r.toFixed(1)}×</strong> the median`;
  const pct = Math.round(Math.abs(r - 1) * 100);
  if (pct < 5) return "about the median";
  return `<strong>${pct} % ${r > 1 ? "above" : "below"}</strong> the median`;
}

/** Anomaly verdict in one statement: "higher than every August" instead of "Percentile 100, Anomaly above ...". */
export function verdictText(anom: boolean, pct: number | null | undefined, baselineYears: string | null | undefined,
                            p90: number, ym: string): string {
  if (anom && pct != null && pct >= 100) {
    return `<span class="flag">Anomaly</span>: higher than every ${monthOnly(ym)} in ${baselineYears ?? "the baseline years"}.`;
  }
  return anom
    ? `<span class="flag">Anomaly</span>: above the 90th percentile of those years (${num(p90)}).`
    : `Not an anomaly: below the 90th percentile of those years (${num(p90)}).`;
}

export function renderMedianPanel(region: RegionFile, ym: string, width = 520, shown?: Series): HTMLElement {
  const el = document.createElement("div");
  el.className = "median";
  const rec = region.months.find((m) => m.ym === ym);
  const seriesName = region.mode === "harmonized" ? "harmonized" : "MODIS";
  if (!rec) {
    el.innerHTML = `<p class="hint">No data for ${ym}.</p>`;
    return el;
  }
  const value = baselineValue(rec, region.mode);
  if (value == null || rec.baseline_median == null || rec.baseline_p90 == null) {
    el.innerHTML = `<h3>${monthYear(ym)}</h3><p class="hint">Too few baseline years to compare this month.</p>`;
    return el;
  }

  const usesViirs = region.mode === "harmonized" && rec.src === "observed";
  const gap = outageNote(rec, usesViirs);
  const daysText = detectionDaysText(rec, usesViirs);
  const backcast = region.mode === "harmonized" && rec.src !== "observed" && rec.harm_lo != null && rec.harm_hi != null;
  // The comparison and the anomaly flags always use the region's own series (burncal-5od).
  const own = shownSeries(region.mode, "harm");
  const otherSeries = shown && shown !== own
    ? `<br><span class="series-note">The calendar shows ${shown === "viirs" ? "raw VIIRS" : "raw MODIS"}; this comparison and the anomaly flags use the ${seriesName} series.</span>`
    : "";
  el.innerHTML = `
    <h3>${monthYear(ym)} vs the median</h3>
    <p><strong>${num(value)}</strong> ${seriesName} detections, ${ratioText(value, rec.baseline_median)}
      of ${monthOnly(ym)} ${rec.baseline_years} (${num(rec.baseline_median)}).
      ${verdictText(rec.anom, rec.anom_pct, rec.baseline_years, rec.baseline_p90, ym)}${otherSeries}
      ${daysText ? `<br><span class="days">${daysText}.</span>` : ""}
      ${gap ? `<br>${gap[0].toUpperCase()}${gap.slice(1)}, the count may be too low.` : ""}
      ${rec.provisional ? "<br>Provisional: built from FIRMS near real-time data, may change when standard processing replaces it." : ""}
      ${backcast ? `<br>Back-cast month: modelled from MODIS, likely range <strong>${num(rec.harm_lo!)}-${num(rec.harm_hi!)}</strong> (10th-90th percentile of the back-cast check).` : ""}</p>`;

  const bars = [
    { label: monthYear(ym), v: value, kind: "month" },
    { label: `median ${rec.baseline_years}`, v: rec.baseline_median, kind: "base" },
    { label: "90th percentile", v: rec.baseline_p90, kind: "base" },
  ];
  // Bar labels sit above each bar instead of in a left margin: the median label is long.
  const band = 38;
  el.append(
    Plot.plot({
      width,
      height: bars.length * band + 22,
      marginLeft: 10,
      marginRight: 52,
      marginTop: 0,
      style: { fontFamily: "inherit", fontSize: "12px" },
      x: { label: null, grid: true, nice: true, domain: [0, Math.max(1, ...bars.map((b) => b.v), backcast ? rec.harm_hi! : 0)], ticks: width < 440 ? 3 : 5, tickFormat: countTick },
      y: { label: null, domain: bars.map((b) => b.label), axis: null, padding: 0 },
      color: { domain: ["month", "base"], range: ["#1d1b19", "#c5bbb0"] },
      marks: [
        Plot.barX(bars, { x: "v", y: "label", fill: "kind", insetTop: 17, insetBottom: 3 }),
        Plot.text(bars, { x: 0, y: "label", text: "label", dx: 3, dy: -11, textAnchor: "start", fill: "currentColor", fontSize: 13 }),
        // Back-cast months: the likely range as a whisker over the month bar.
        ...(backcast
          ? [
              Plot.ruleY([bars[0]], { y: "label", x1: () => rec.harm_lo, x2: () => rec.harm_hi, dy: 7, stroke: RANGE_STROKE, strokeWidth: 2 }),
              Plot.tickX([rec.harm_lo!, rec.harm_hi!], { x: (d: number) => d, y: () => bars[0].label, stroke: RANGE_STROKE, strokeWidth: 2, insetTop: 15, insetBottom: 1 }),
            ]
          : []),
        Plot.text(bars, {
          x: (b: { v: number; kind: string }) => (backcast && b.kind === "month" ? Math.max(b.v, rec.harm_hi!) : b.v),
          y: "label", text: (b: { v: number }) => num(b.v), dx: 5, dy: 7, textAnchor: "start", fontWeight: 600,
        }),
        Plot.ruleX([0]),
      ],
    }),
  );
  return el;
}
