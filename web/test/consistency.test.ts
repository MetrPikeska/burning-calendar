// Cross-tool checks over the real data in public/data/v1: the same number must come out of every tool,
// every number must carry a unit, windows must be what they claim, and relative regions never leak a count.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CountryCode, IndexFile, RegionFile } from "../src/lib/contract.ts";
import {
  aggregate, anomaliesFor, baselineKind, COMPARE_METRICS, compareRegions, COUNT_METRICS, type CountryValidation, monthContext,
  RANK_METRICS, rankRegions, regionSeries, regionSummary, searchRegions, seasonCalendar, unitOf, validationFor,
} from "../api/_lib/tools.ts";

const read = <T>(p: string) => JSON.parse(readFileSync(`public/data/v1/${p}`, "utf8")) as T;
const index: Record<CountryCode, IndexFile> = { gr: read("gr/index.json"), ar: read("ar/index.json") };
const region = (c: CountryCode, id: string) => read<RegionFile>(`${c}/regions/${id}.json`);
const all = (c: CountryCode) => readdirSync(`public/data/v1/${c}/regions`).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const period = index.gr.period;
const country = (id: string): CountryCode => (/^(GR|EL)/.test(id) ? "gr" : "ar");
const item = (id: string) => {
  const c = country(id);
  return { country: c, entry: index[c].regions.find((r) => r.id === id)!, region: region(c, id) };
};
type YearRec = { year: number; harm?: number; modis: number };

describe("one number, every tool", () => {
  for (const id of ["GR", "EL52", "AR", "30"]) {
    for (const year of [2005, 2020]) {
      it(`${id} ${year}: aggregate = series year total = sum of months`, () => {
        const r = region(country(id), id);
        const from = `${year}-01`, to = `${year}-12`;
        const agg = aggregate([r], { from, to, top: 3 }, period);
        const yearly = regionSeries(r, { from, to, aggregate: "year" }, period).records as YearRec[];
        const monthly = regionSeries(r, { from, to, aggregate: "month" }, period) as { totals: { total: number }[] };
        const sum = r.months.filter((m) => m.ym >= from && m.ym <= to).reduce((a, m) => a + (m.harm ?? 0), 0);
        expect(agg.total).toBeCloseTo(sum, 0);
        expect(yearly[0].harm).toBeCloseTo(sum, 0);
        expect(monthly.totals[0].total).toBeCloseTo(sum, 0);
        const yt = compareRegions([item(id), item(id === "GR" ? "EL30" : id === "AR" ? "06" : id === "EL52" ? "EL30" : "06")], "year_total", year);
        expect(yt.rows.find((x) => x.id === id)!.value).toBeCloseTo(sum, 0);
      });
    }
  }

  // Raw VIIRS S-NPP per calendar year from get_region_series (aggregate would switch to MODIS for all, because
  // EL62, 02 and 94 are relative). Measured 15 Nov 2026 over Feb 2012 - Oct 2026: the NUTS2 regions add up to
  // 0.25 % below GR (78,025 vs 78,218; at most 6.6 % in a month over 100), the provinces to AR within 0.01 %.
  it("national raw VIIRS matches the sum of its regions, 2013-2025", () => {
    for (const [c, nat, tol] of [["gr", "GR", 0.005], ["ar", "AR", 0.0001]] as const) {
      const viirs = (id: string) => (regionSeries(region(c, id), { from: "2013-01", to: "2025-12", aggregate: "year" }, period)
        .records as { viirs?: number }[]).reduce((a, r) => a + r.viirs!, 0);
      const national = viirs(nat);
      const parts = all(c).filter((id) => id !== nat).reduce((a, id) => a + viirs(id), 0);
      expect(national).toBeGreaterThan(0);
      expect(Math.abs(parts - national) / national).toBeLessThan(tol);
    }
  });

  it("national raw MODIS matches the sum of its regions through aggregate (relative regions present)", () => {
    for (const [c, nat] of [["gr", "GR"], ["ar", "AR"]] as const) {
      const p = { from: "2001-01", to: "2025-12", top: 1 };
      const parts = aggregate(all(c).filter((id) => id !== nat).map((id) => region(c, id)), p, period);
      expect(parts.series).toBe("modis");
      const national = region(c, nat).months.filter((m) => m.ym >= p.from && m.ym <= p.to).reduce((a, m) => a + m.modis, 0);
      expect(Math.abs(parts.total - national) / national).toBeLessThan(0.005);
    }
  });
});

/** Paths to every numeric field in a result (outside caveats and coverage). */
function numericPaths(v: unknown, path: string[] = [], out: string[][] = [],
                      skip = new Set(["caveats", "coverage", "units", "requested", "returned"])): string[][] {
  if (Array.isArray(v)) v.forEach((x) => numericPaths(x, path, out, skip));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (skip.has(k)) continue;
      if (typeof x === "number") out.push([...path, k]);
      else numericPaths(x, [...path, k], out, skip);
    }
  }
  return out;
}
function unitKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => unitKeys(x, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (k === "units" && x && typeof x === "object") Object.keys(x).forEach((u) => out.add(u));
      else unitKeys(x, out);
    }
  }
  return out;
}
/** Labels, not quantities: calendar years and counts of returned rows. */
const NOT_QUANTITIES = new Set(["year", "season_year", "count"]);

describe("units", () => {
  const er = region("ar", "30"), el62 = region("gr", "EL62"), p94 = region("ar", "94");
  const cases: [string, unknown][] = [
    ["search_regions", searchRegions([index.gr, index.ar], { limit: 50 })],
    ["series month harmonized", regionSeries(er, { from: "2011-01", to: "2020-12", aggregate: "month", fields: ["ym", "modis", "viirs", "harm", "harm_lo", "harm_hi", "anom_pct", "baseline_median", "baseline_p90", "days_modis", "days_viirs"] }, period)],
    ["series month relative", regionSeries(el62, { from: "2020-01", to: "2020-12", aggregate: "month" }, period)],
    ["series year", regionSeries(er, { from: "2001-01", to: "2025-12", aggregate: "year" }, period)],
    ["season calendar", seasonCalendar(er, undefined, period)],
    ["anomalies", anomaliesFor(er, 2020, period)],
    ["anomalies relative", anomaliesFor(p94, 2020, period)],
    ["aggregate", aggregate([er, region("ar", "06")], { from: "2005-01", to: "2020-12", top: 5 }, period)],
    ["month context", monthContext(region("gr", "EL64"), "2021-08", period)],
    ["find_region_at summary", regionSummary("gr", item("EL64").entry, region("gr", "EL64"))],
    ["validation region", validationFor(region("gr", "EL52"))],
    ["validation country", validationFor(region("ar", "AR"), { validation: read<CountryValidation>("ar/validation.json"), index: index.ar })],
    ...COMPARE_METRICS.map((m) => [`compare ${m}`, compareRegions([item("30"), item("94"), item("EL52")], m, 2020)] as [string, unknown]),
    ...RANK_METRICS.map((m) => [`rank ${m}`, rankRegions([...index.gr.regions, ...index.ar.regions].map((e) => item(e.id)), m, { year: 2020, top: 50, order: "desc" })] as [string, unknown]),
  ];
  for (const [name, result] of cases) {
    it(`${name}: every numeric field has a unit`, () => {
      const units = unitKeys(result);
      const paths = numericPaths(result);
      expect(paths.length).toBeGreaterThan(0);
      // A field is covered by a unit on its own key or on any key above it (e.g. ratio_by_year.day.2012).
      const missing = paths.filter((p) => !NOT_QUANTITIES.has(p[p.length - 1]) && !p.some((k) => units.has(k)));
      expect([...new Set(missing.map((p) => p.join(".")))]).toEqual([]);
    });
  }

  it("unitOf() in the MCP gives the same text as pipeline/export.py wrote into every region file", () => {
    for (const c of ["gr", "ar"] as const) for (const id of all(c)) {
      const f = region(c, id);
      expect(unitOf(f.mode), `${c}/${id}`).toBe(f.units);
    }
  });

  it("relative regions say raw MODIS, harmonized ones VIIRS-equivalent", () => {
    expect(regionSeries(p94, { from: "2020-01", to: "2020-12", aggregate: "month" }, period).unit).toMatch(/^raw MODIS/);
    expect(regionSeries(er, { from: "2020-01", to: "2020-12", aggregate: "month" }, period).unit).toMatch(/^VIIRS-equivalent/);
    expect(anomaliesFor(p94, 2020, period).units.value).toMatch(/raw MODIS/);
    expect(anomaliesFor(er, 2020, period).units.value).toMatch(/VIIRS-equivalent/);
    const agg = aggregate([er, region("ar", "06")], { from: "2020-01", to: "2020-12", top: 3 }, period);
    expect(agg.units.top_months).toMatch(/per month, summed over the regions/);
    const cmp = compareRegions([item("30"), item("94")], "annual_mean");
    expect(cmp.units.value).toMatch(/VIIRS-equivalent/);
    expect(cmp.units.value_modis).toMatch(/raw MODIS/);
  });
});

describe("windows", () => {
  const months = (w: { from: string; to: string }) =>
    (Number(w.to.slice(0, 4)) - Number(w.from.slice(0, 4))) * 12 + Number(w.to.slice(5)) - Number(w.from.slice(5)) + 1;

  it("every season_window has 12 months and year_total runs January to December", () => {
    const items = [...index.gr.regions, ...index.ar.regions].map((e) => item(e.id));
    for (const year of [2003, 2012, 2020, 2025]) {
      const st = rankRegions(items, "season_total", { year, top: 50, order: "desc" });
      for (const r of [...st.ranked, ...(st.incomplete_season ?? [])] as { season_window?: { from: string; to: string } }[]) {
        expect(months(r.season_window!)).toBe(12);
      }
      const yt = rankRegions(items, "year_total", { year, top: 50, order: "desc" });
      for (const r of yt.ranked as { window?: unknown }[]) expect(r.window).toEqual({ from: `${year}-01`, to: `${year}-12` });
    }
  });

  it("year_total does not rank an incomplete year (2026 ends in October)", () => {
    const r = compareRegions([item("EL52"), item("EL30")], "year_total", 2026);
    expect(r.ranking_allowed).toBe(false);
    expect(r.rows.every((x) => x.value === undefined && x.incomplete_year)).toBe(true);
    expect(r.caveats.map((c) => c.code)).toContain("out_of_coverage");
  });
});

describe("relative regions never leak a count into value", () => {
  const rel = [item("94"), item("02"), item("EL62")];
  for (const metric of COUNT_METRICS) {
    it(metric, () => {
      const cmp = compareRegions([...rel, item("30")], metric, 2020);
      for (const r of cmp.rows.filter((x) => x.mode === "relative")) expect(r.value).toBeUndefined();
      expect(cmp.ranking_allowed).toBe(false);
      const rank = rankRegions([...rel, item("30"), item("EL52")], metric as (typeof RANK_METRICS)[number], { year: 2020, top: 10, order: "desc" });
      expect(rank.ranked.map((r) => r.id)).not.toEqual(expect.arrayContaining(["94"]));
      expect(rank.excluded_relative.map((r) => r.id).sort()).toEqual(["02", "94", "EL62"]);
    });
  }
});

describe("baseline_kind", () => {
  it("reads the end of the year range, not a year named after 'without'", () => {
    expect(baselineKind("2020-08", "2010-2019")).toBe("retrospective");
    expect(baselineKind("2005-08", "2002-2011 without 2005")).toBe("fixed_2002_2011");
    expect(baselineKind("2009-08", "2002-2011 without 2008")).toBe("fixed_2002_2011");
    expect(baselineKind("2012-03", "2002-2011")).toBe("retrospective");
    expect(baselineKind("2012-03", null)).toBeNull();
  });
});
