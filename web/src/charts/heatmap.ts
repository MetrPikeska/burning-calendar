// Year x month burning calendar with Observable Plot.
import * as Plot from "@observablehq/plot";
import type { MonthRecord, RegionFile, Series } from "../lib/contract.ts";
import { COLOR_SCHEME, NO_SCALE_GREY, countTick, rampLegend } from "./ramp.ts";

export { COLOR_SCHEME };

/** Mark colours, shared with the key under the chart. */
export const ANOMALY_STROKE = "#2a9df4";
const RING_OUTER = "#111";
const RING_INNER = "#fff";
const OUTAGE_FILL = "#1d1b19";

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
  if (r.anom_pct != null) lines.push(`percentile vs preceding 10 years: ${Math.round(r.anom_pct)}`);
  if (r.anom) lines.push("ANOMALY: above the baseline 90th percentile");
  if (showsOutage(c, series)) lines.push(`known MODIS outage: ${r.outage_days} days`);
  return lines.join("\n");
}

export interface Range {
  from: string | null;
  to: string | null;
}

function inRange(ym: string, r: Range): boolean {
  return (!r.from || ym >= r.from) && (!r.to || ym <= r.to);
}

/** The outage cross only where the shown series depends on MODIS (data/outages.csv lists Aqua only). */
function showsOutage(c: Cell, series: Series): boolean {
  return !!c.rec.outage && (series === "modis" || (series === "harm" && c.rec.src !== "observed"));
}

/**
 * Colour legend + calendar, `width` px wide. Cells outside `range` are dimmed, not removed,
 * so the calendar keeps its shape.
 */
export function renderHeatmap(
  region: RegionFile,
  series: Series,
  range: Range = { from: null, to: null },
  selectedYm: string | null = null,
  onPick?: (ym: string) => void,
  width = 520,
): HTMLElement {
  const cells = toCells(region.months, series);
  const years = [...new Set(cells.map((c) => c.year))].sort((a, b) => a - b);
  const marginLeft = 40;
  const marginTop = 24;
  const cellW = (width - marginLeft - 4) / 12;
  const narrow = width < 440;
  // Phones get taller rows so a finger can hit one year; desktop stays compact.
  const rowH = narrow ? 16 : Math.max(12, Math.min(14, cellW * 0.36));
  const selectedYear = selectedYm ? Number(selectedYm.slice(0, 4)) : null;
  const dim = (c: Cell) => (inRange(c.rec.ym, range) ? 1 : 0.16);
  const colorLabel = `${SERIES_LABEL[series]}, detections / month`;

  const plot = Plot.plot({
    width,
    height: years.length * rowH + marginTop + 4,
    marginLeft,
    marginRight: 4,
    marginTop,
    marginBottom: 4,
    padding: 0.08,
    style: { fontFamily: "inherit", fontSize: "13px" },
    x: {
      type: "band",
      domain: [...Array(12).keys()],
      tickFormat: Plot.formatMonth("en", narrow ? "narrow" : "short"),
      label: null,
      axis: "top",
      tickSize: 0,
    },
    y: { type: "band", domain: years, label: null, ticks: years.filter((y) => y % 5 === 0 && Math.abs(y - (selectedYear ?? -9)) > 1), tickSize: 0 },
    color: {
      type: "sqrt",
      scheme: COLOR_SCHEME,
      reverse: true,
      unknown: NO_SCALE_GREY,
      label: colorLabel,
    },
    marks: [
      Plot.cell(cells, { x: "month", y: "year", fill: "value", fillOpacity: dim, title: (c: Cell) => title(c, series), tip: true }),
      // Anomalies: thin outline, inset so neighbouring outlines do not merge.
      Plot.cell(cells.filter((c) => c.rec.anom && inRange(c.rec.ym, range)), {
        x: "month", y: "year", fill: null, stroke: ANOMALY_STROKE, strokeWidth: 1.5, inset: 1.5,
      }),
      // Known MODIS outages: a cross with a white halo, readable on every ramp colour.
      Plot.text(cells.filter((c) => showsOutage(c, series)), {
        x: "month", y: "year", text: () => "×", fill: OUTAGE_FILL, stroke: "white", strokeWidth: 3, paintOrder: "stroke", fontSize: 13, fontWeight: 600,
      }),
      // Month shown in the median panel: black ring outside, white ring inside, visible on pale and black cells.
      Plot.cell(cells.filter((c) => c.rec.ym === selectedYm), { x: "month", y: "year", fill: null, stroke: RING_OUTER, strokeWidth: 2.5, inset: -1 }),
      Plot.cell(cells.filter((c) => c.rec.ym === selectedYm), { x: "month", y: "year", fill: null, stroke: RING_INNER, strokeWidth: 1.5, inset: 1.25 }),
      // Year of the compared month, bold in the left margin, so the picked row is easy to read.
      ...(selectedYear != null
        ? [Plot.text([selectedYear], { y: (d: number) => d, frameAnchor: "left", dx: -6, textAnchor: "end", text: (d: number) => String(d), fontWeight: 700, fill: "currentColor" })]
        : []),
    ],
  });

  const colorScale = plot.scale("color");
  const legend = colorScale
    ? rampLegend(colorLabel, colorScale.domain as [number, number], Math.min(300, width - marginLeft), countTick)
    : "";

  if (onPick) {
    // The tip's pointer keeps the hovered datum in plot.value; a click picks that month.
    plot.style.cursor = "pointer";
    // The cell comes from the click position through the band scales, so a tap works without hover.
    const sx = plot.scale("x")!;
    const sy = plot.scale("y")!;
    const band = (s: typeof sx, v: number) =>
      (s.domain as number[]).find((d) => v >= Number(s.apply(d)) && v < Number(s.apply(d)) + (s.step ?? 0));
    const known = new Set(region.months.map((m) => m.ym));
    plot.addEventListener("click", (ev) => {
      const e = ev as MouseEvent;
      const r = plot.getBoundingClientRect();
      const k = width / r.width;
      const month = band(sx, (e.clientX - r.left) * k);
      const year = band(sy, (e.clientY - r.top) * k);
      if (month == null || year == null) return;
      const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
      if (known.has(ym)) onPick(ym);
    });
  }

  const wrap = document.createElement("div");
  wrap.className = "heatmap";
  if (legend) {
    const lg = document.createElement("div");
    lg.className = "heatmap-legend";
    lg.style.paddingLeft = `${marginLeft}px`;
    lg.innerHTML = legend;
    wrap.append(lg);
  }
  wrap.append(plot);
  return wrap;
}

const SW = 14;
const swatch = (inner: string) =>
  `<svg width="${SW}" height="${SW}" viewBox="0 0 ${SW} ${SW}" aria-hidden="true">${inner}</svg>`;

/** Key for the calendar marks; items appear only when they can occur for this view. */
export function marksKey(series: Series, hasRange: boolean): string {
  const pale = "#fbe7a6";
  const items: [string, string][] = [
    [swatch(`<rect x="1" y="1" width="12" height="12" fill="#c33b4c"/><rect x="2.25" y="2.25" width="9.5" height="9.5" fill="none" stroke="${ANOMALY_STROKE}" stroke-width="1.5"/>`),
      "Anomaly: above the 90th percentile of the preceding 10 years"],
    [swatch(`<rect x="1" y="1" width="12" height="12" fill="${pale}"/><rect x="1.25" y="1.25" width="11.5" height="11.5" fill="none" stroke="${RING_OUTER}" stroke-width="2.5"/><rect x="3.4" y="3.4" width="7.2" height="7.2" fill="none" stroke="${RING_INNER}" stroke-width="1.5"/>`),
      "Month compared with its median"],
  ];
  if (series !== "viirs") {
    items.push([swatch(`<rect x="1" y="1" width="12" height="12" fill="${pale}"/><text x="7" y="11" text-anchor="middle" font-size="12" font-weight="600" fill="${OUTAGE_FILL}">×</text>`),
      "Known MODIS outage"]);
  }
  items.push([swatch(`<rect x="1" y="1" width="12" height="12" fill="${NO_SCALE_GREY}"/>`), "No value"]);
  if (hasRange) items.push([swatch(`<rect x="1" y="1" width="12" height="12" fill="#c33b4c" opacity="0.16"/>`), "Outside the date range"]);
  return `<ul class="key">${items.map(([s, t]) => `<li>${s}<span>${t}</span></li>`).join("")}</ul>`;
}
