import { describe, expect, it } from "vitest";
import type { MonthRecord, RegionContext } from "../src/lib/contract.ts";
import { contextFor, contextSentence } from "../src/lib/context.ts";

const base = {
  modis: 1, viirs: null, harm: 1, harm_lo: null, harm_hi: null, src: "backcast", fit_level: null, anom_pct: null,
  anom: false, outage_days: 0, outage: false, baseline_median: null, baseline_p90: null, baseline_years: null,
} as const;

const months = [
  { ...base, ym: "2021-08", fwi: 41.2, fwi_pct: 96.2, fwi_level: "critical", spei3: -1.4, spei3_level: "dry", spei6: null },
  { ...base, ym: "2021-09" },
] as MonthRecord[];

const context: RegionContext = {
  available: true,
  landcover: { cropland_pct: 40, tree_pct: 10, shrub_grass_pct: 20, other_pct: 30, source: "CORINE Land Cover 2018" },
  sources: {},
};

describe("contextFor", () => {
  it("returns FWI, SPEI and land cover for a month with data", () => {
    const c = contextFor({ months, context }, "2021-08")!;
    expect(c.fwi).toEqual({ value: 41.2, pct: 96.2, level: "critical" });
    expect(c.spei).toEqual([{ label: "SPEI-3", value: -1.4, level: "dry" }]);
    expect(c.landcover?.cropland_pct).toBe(40);
  });

  it("keeps land cover for a month without weather values", () => {
    const c = contextFor({ months, context }, "2021-09")!;
    expect(c.fwi).toBeNull();
    expect(c.spei).toEqual([]);
    expect(c.landcover).not.toBeNull();
  });

  it("returns null when nothing is available, so the panel is hidden", () => {
    expect(contextFor({ months, context: undefined }, "2021-09")).toBeNull();
    expect(contextFor({ months, context: { available: false, landcover: null, sources: {} } }, "2021-08")).not.toBeNull();
    expect(contextFor({ months: [{ ...base, ym: "2000-11" } as MonthRecord], context: undefined }, "2000-11")).toBeNull();
    expect(contextFor({ months, context }, "1999-01")!.fwi).toBeNull();
  });
});

describe("contextSentence", () => {
  it("states levels in words and makes no causal claim", () => {
    const s = contextSentence(contextFor({ months, context }, "2021-08")!);
    expect(s).toContain("FWI 41.2");
    expect(s).toContain("percentile 96");
    expect(s).toContain("critical fire weather");
    expect(s).toContain("SPEI-3 -1.40 (dry)");
    expect(s).not.toMatch(/caus/i);
  });
});
