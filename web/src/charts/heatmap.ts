// Year x month burning calendar with Observable Plot.
import * as Plot from "@observablehq/plot";
import type { MonthRecord, RegionFile, Series } from "../lib/contract.ts";

/** Perceptually uniform, colour-blind safe ramp. Swap here if the team prefers viridis/cividis. */
export const COLOR_SCHEME = "inferno";

const SERIES_LABEL: Record<Series, string> = {
  harm: "Harmonized (VIIRS-equivalent)",
  modis: "MODIS (Terra + Aqua)",
  viirs: "VIIRS S-NPP",
};

interface Cell {
  year: number;
  month: number; // 0-11 for Plot.formatMonth
  value: number | null;
  rec: MonthRecord;
}

function toCells(months: MonthRecord[], series: Series): Cell[] {
  return months.map((rec) => ({
    year: Number(rec.ym.slice(0, 4)),
    month: Number(rec.ym.slice(5, 7)) - 1,
    value: rec[series],
    rec,
  }));
}

function fmt(n: number | null): string {
  return n == null ? "n/a" : n >= 100 ? Math.round(n).toLocaleString("en") : n.toFixed(1);
}

function title(c: Cell, series: Series): string {
  const r = c.rec;
  const lines = [`${r.ym}  ${SERIES_LABEL[series]}: ${fmt(c.value)}`];
  if (series === "harm" && r.src !== "observed") {
    lines.push(`back-cast from MODIS, range ${fmt(r.harm_lo)}-${fmt(r.harm_hi)}`);
  }
  lines.push(`MODIS ${fmt(r.modis)}  VIIRS ${fmt(r.viirs)}`);
  if (r.anom_pct != null) lines.push(`percentile vs preceding 10 years: ${r.anom_pct}`);
  if (r.anom) lines.push("ANOMALY: above the baseline 90th percentile");
  if (r.outage) lines.push(`known MODIS outage: ${r.outage_days} days`);
  return lines.join("\n");
}

export interface Range {
  from: string | null;
  to: string | null;
}

function inRange(ym: string, r: Range): boolean {
  return (!r.from || ym >= r.from) && (!r.to || ym <= r.to);
}

/** Cells outside `range` are dimmed, not removed, so the calendar keeps its shape. */
export function renderHeatmap(
  region: RegionFile,
  series: Series,
  range: Range = { from: null, to: null },
  selectedYm: string | null = null,
  onPick?: (ym: string) => void,
): SVGSVGElement | HTMLElement {
  const cells = toCells(region.months, series);
  const dim = (c: Cell) => (inRange(c.rec.ym, range) ? 1 : 0.18);
  const plot = Plot.plot({
    width: 520,
    height: 26 * 17 + 50,
    marginLeft: 44,
    padding: 0.06,
    x: { type: "band", domain: [...Array(12).keys()], tickFormat: Plot.formatMonth("en", "short"), label: null, axis: "top" },
    y: { type: "band", label: null, tickFormat: (y: number) => (y % 5 === 0 ? String(y) : "") },
    color: {
      type: "sqrt",
      scheme: COLOR_SCHEME,
      reverse: true,
      unknown: "#e6e6e6",
      legend: true,
      label: `${SERIES_LABEL[series]}, detections / month`,
    },
    marks: [
      Plot.cell(cells, { x: "month", y: "year", fill: "value", fillOpacity: dim, title: (c: Cell) => title(c, series), tip: true }),
      // Anomalies: outlined cells.
      Plot.cell(cells.filter((c) => c.rec.anom && inRange(c.rec.ym, range)), { x: "month", y: "year", fill: null, stroke: "#0b62a4", strokeWidth: 2, inset: 1 }),
      // Known MODIS outages (data/outages.csv): a cross where the shown series depends on MODIS.
      Plot.text(cells.filter((c) => c.rec.outage && (series === "modis" || (series === "harm" && c.rec.src !== "observed"))), { x: "month", y: "year", text: () => "×", fill: "#0b62a4", fontSize: 14 }),
      // Month shown in the median panel.
      Plot.cell(cells.filter((c) => c.rec.ym === selectedYm), { x: "month", y: "year", fill: null, stroke: "#000", strokeWidth: 2.5 }),
    ],
  });
  if (onPick) {
    // The tip's pointer keeps the hovered datum in plot.value; a click picks that month.
    plot.style.cursor = "pointer";
    plot.addEventListener("click", () => {
      const c = (plot as unknown as { value?: Cell | null }).value;
      if (c) onPick(c.rec.ym);
    });
  }
  return plot;
}
