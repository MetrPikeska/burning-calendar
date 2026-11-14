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
