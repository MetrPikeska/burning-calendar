// One colour ramp for the calendar and the map: reversed inferno, pale = few detections.
import * as Plot from "@observablehq/plot";

/** Perceptually uniform, colour-blind safe ramp. Swap here if the team prefers viridis/cividis. */
export const COLOR_SCHEME = "inferno";

/** The map stops at 90 % of the ramp: the near-black end would bury basemap labels. */
export const MAP_RAMP_MAX = 0.9;

/** Grey for regions without a harmonized scale (relative mode) and for missing cells. */
export const NO_SCALE_GREY = "#c9c6c1";

const scale = Plot.scale({ color: { type: "linear", scheme: COLOR_SCHEME, reverse: true, domain: [0, 1] } });

/** The map starts slightly above the palest yellow, which vanishes on a light basemap. */
export const MAP_RAMP_MIN = 0.06;

/** `n` evenly spaced colours over [min, max] of the ramp. */
export function rampColors(n: number, max = 1, min = 0): string[] {
  return Array.from({ length: n }, (_, i) => String(scale.apply(min + (i / (n - 1)) * (max - min))));
}

/** Compact count labels for legends and axes: 0, 200, 1.5k, 20k. */
export function countTick(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 1000) return `${+(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(+n.toFixed(1));
}

/** d3-style nice ticks: steps of 1, 2 or 5 x 10^k, about `count` of them over [lo, hi]. */
export function niceTicks(lo: number, hi: number, count: number): number[] {
  if (!(hi > lo) || count <= 0) return [lo];
  const raw = (hi - lo) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const err = raw / power;
  const step = (err >= Math.sqrt(50) ? 10 : err >= Math.sqrt(10) ? 5 : err >= Math.SQRT2 ? 2 : 1) * power;
  const out: number[] = [];
  for (let k = Math.ceil(lo / step); k * step <= hi + step * 1e-9; k++) out.push(+(k * step).toPrecision(12));
  return out;
}

const LEGEND_STOPS = rampColors(17)
  .map((c, i) => `<stop offset="${(i / 16).toFixed(4)}" stop-color="${c}"/>`)
  .join("");
let legendId = 0;

/**
 * Colour legend for a sqrt colour scale, laid out like Plot's ramp legend (bold label, 10 px ramp,
 * ticks below). Plot paints its ramp on a canvas and encodes it with toDataURL on every render,
 * which took most of a region switch; this is a static SVG gradient instead.
 */
export function rampLegend(label: string, domain: [number, number], width: number, tickFormat: (n: number) => string, ticks = 4): string {
  const [lo, hi] = domain;
  const s0 = Math.sqrt(lo);
  const span = Math.sqrt(hi) - s0 || 1;
  const x = (v: number) => Math.round(((Math.sqrt(v) - s0) / span) * width);
  const id = `ramp-${++legendId}`;
  const tickMarks = niceTicks(lo, hi, ticks)
    .map((v) => `<g transform="translate(${x(v)},28)"><line y1="-10" y2="6" stroke="currentColor"/><text y="9" dy="0.71em" text-anchor="middle" fill="currentColor">${tickFormat(v)}</text></g>`)
    .join("");
  return `<svg class="ramp-legend" width="${width}" height="50" viewBox="0 0 ${width} 50" font-size="11" font-variant="tabular-nums" style="display:block;max-width:100%;height:auto;overflow:visible;font-family:inherit">
    <defs><linearGradient id="${id}">${LEGEND_STOPS}</linearGradient></defs>
    <rect y="18" width="${width}" height="10" fill="url(#${id})"/>${tickMarks}
    <text y="12" fill="currentColor" font-weight="bold">${label}</text></svg>`;
}
