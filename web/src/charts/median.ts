// Panel "chosen month vs median of the preceding 10 years", from the pipeline's baseline_* fields.
import * as Plot from "@observablehq/plot";
import { baselineValue, type MonthRecord, type RegionFile } from "../lib/contract.ts";

const monthYear = (ym: string) =>
  new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
const monthOnly = (ym: string) =>
  new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en", { month: "long", timeZone: "UTC" });
const num = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("en") : n.toFixed(1));

/** Month to show first: the strongest month inside [from, to], else the latest month of the series. */
export function defaultMonth(region: RegionFile, from: string | null, to: string | null): string {
  const inRange = region.months.filter((m) => (!from || m.ym >= from) && (!to || m.ym <= to));
  if (!from && !to) return region.months[region.months.length - 1].ym;
  let best: MonthRecord | null = null;
  for (const m of inRange) {
    const v = baselineValue(m, region.mode) ?? -1;
    if (!best || v > (baselineValue(best, region.mode) ?? -1)) best = m;
  }
  return (best ?? region.months[region.months.length - 1]).ym;
}

function ratioText(value: number, median: number): string {
  if (median <= 0) return value > 0 ? "above a zero median" : "equal to the median";
  const r = value / median;
  if (r >= 1.5) return `<strong>${r >= 10 ? Math.round(r) : r.toFixed(1)}×</strong> the median`;
  if (r <= 0.67) return `<strong>${Math.round((1 - r) * 100)} % below</strong> the median`;
  return "close to the median";
}

export function renderMedianPanel(region: RegionFile, ym: string): HTMLElement {
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

  const verdict = rec.anom
    ? `<span class="flag">Anomaly</span> above the 90th percentile (${num(rec.baseline_p90)})`
    : `below the 90th percentile (${num(rec.baseline_p90)})`;
  el.innerHTML = `
    <h3>${monthYear(ym)} vs the median</h3>
    <p><strong>${num(value)}</strong> ${seriesName} detections, ${ratioText(value, rec.baseline_median)}
      of ${monthOnly(ym)} ${rec.baseline_years} (${num(rec.baseline_median)}).
      Percentile ${rec.anom_pct ?? "n/a"}, ${verdict}.
      ${rec.outage && (region.mode === "relative" || rec.src !== "observed") ? `<br>Known MODIS outage: ${rec.outage_days} days, the count may be too low.` : ""}
      ${region.mode === "harmonized" && rec.src !== "observed" ? `<br>Back-cast month, range ${num(rec.harm_lo ?? 0)}-${num(rec.harm_hi ?? 0)}.` : ""}</p>`;

  const bars = [
    { label: monthYear(ym), v: value, kind: "month" },
    { label: `median ${rec.baseline_years}`, v: rec.baseline_median, kind: "base" },
    { label: "90th percentile", v: rec.baseline_p90, kind: "base" },
  ];
  el.append(
    Plot.plot({
      width: 520,
      height: 96,
      marginLeft: 170,
      x: { label: null, grid: true, nice: true },
      y: { label: null, domain: bars.map((b) => b.label) },
      color: { domain: ["month", "base"], range: ["#b2182b", "#b8b0a6"] },
      marks: [
        Plot.barX(bars, { x: "v", y: "label", fill: "kind" }),
        Plot.text(bars, { x: "v", y: "label", text: (b: { v: number }) => num(b.v), dx: 4, textAnchor: "start" }),
        Plot.ruleX([0]),
      ],
    }),
  );
  return el;
}
