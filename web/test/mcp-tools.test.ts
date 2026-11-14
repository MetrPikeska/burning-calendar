import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile, RegionFile } from "../src/lib/contract.ts";
import type { RegionCollection } from "../src/lib/geo.ts";
import {
  anomaliesFor,
  compareRegions,
  countryOf,
  locate,
  regionSummary,
  regionSeries,
  searchRegions,
  seasonCalendar,
  viewUrl,
  withCoverage,
} from "../api/_lib/tools.ts";

const read = <T>(p: string) => JSON.parse(readFileSync(`public/data/v1/${p}`, "utf8")) as T;
const grIndex = read<IndexFile>("gr/index.json");
const arIndex = read<IndexFile>("ar/index.json");
const er = read<RegionFile>("ar/regions/30.json"); // Entre Ríos, harmonized
const el62 = read<RegionFile>("gr/regions/EL62.json"); // Ionia Nisia, relative
const period = arIndex.period; // 2000-11 .. 2025-12
type Monthly = {
  records: Record<string, unknown>[];
  totals: { year: number; series: string; total: number; n_months: number; partial: boolean }[];
};
/** regionSeries in month mode (the return type is a union of month and year shapes). */
const monthly = (r: unknown) => r as Monthly;
const NEAR_COAST = { lat: 40.58, lon: 22.93, id: "EL52" }; // Thermaikos Gulf, 1.8 km off the 1:20M coastline

describe("countryOf", () => {
  it("infers the country from the region id", () => {
    expect(countryOf("EL52")).toBe("gr");
    expect(countryOf("GR")).toBe("gr");
    expect(countryOf("30")).toBe("ar");
    expect(countryOf("AR")).toBe("ar");
    expect(countryOf("XX9")).toBeNull();
  });
});

describe("viewUrl", () => {
  it("builds a deep link with the web's URL state", () => {
    expect(viewUrl("ar", "30", "2020-01", "2020-12")).toBe(
      "https://burning-calendar.vercel.app/?country=ar&region=30&from=2020-01&to=2020-12",
    );
  });
});

describe("searchRegions", () => {
  it("filters by query and country and returns view_url", () => {
    const r = searchRegions([grIndex, arIndex], { query: "entre", limit: 10 });
    expect(r.regions.map((x) => x.id)).toEqual(["30"]);
    expect(r.regions[0].view_url).toContain("region=30");
  });

  it("filters by level", () => {
    const r = searchRegions([grIndex, arIndex], { country: "GR", level: "nuts2", limit: 50 });
    expect(r.regions).toHaveLength(13);
  });
});

describe("regionSeries", () => {
  it("returns monthly records with caveats for back-cast months", () => {
    const r = regionSeries(er, { from: "2010-06", to: "2012-03", aggregate: "month" }, period);
    expect(r.records).toHaveLength(22);
    expect(r.records[0]).toMatchObject({ ym: "2010-06", src: "backcast" });
    expect(r.caveats.map((c) => c.code)).toContain("backcast");
    expect(r.csv_url).toBe("https://burning-calendar.vercel.app/data/v1/ar/regions/30.csv");
  });

  it("refuses more than 120 monthly records", () => {
    expect(() => regionSeries(er, { from: "2001-01", to: "2025-12", aggregate: "month" }, period)).toThrow(/120/);
  });

  it("aggregates calendar years", () => {
    const r = regionSeries(er, { from: "2019-01", to: "2020-12", aggregate: "year" }, period);
    const rows = r.records as { year: number; viirs: number | null }[];
    expect(rows.map((x) => x.year)).toEqual([2019, 2020]);
    expect(rows[1].viirs).toBeGreaterThan(30000);
  });

  it("flags relative mode and leaves harm null", () => {
    const r = regionSeries(el62, { from: "2020-01", to: "2020-12", aggregate: "month" }, period);
    expect(r.caveats[0].code).toBe("relative_mode");
    expect(r.records.every((x) => !("harm" in x))).toBe(true);
  });
});

describe("seasonCalendar", () => {
  it("returns climatology and one season year", () => {
    const r = seasonCalendar(er, 2020, period);
    expect(r.climatology.season_start_month).toBe(er.summary.season_start_month);
    expect(r.years).toHaveLength(1);
    expect(r.years[0].season_year).toBe(2020);
  });
});

describe("anomaliesFor", () => {
  it("compares each month with its baseline median", () => {
    const r = anomaliesFor(er, 2020, period);
    const aug = r.months.find((m) => m.ym === "2020-08")!;
    expect(aug.anom).toBe(true);
    expect(aug.baseline_years).toBe("2010-2019");
    expect(aug.ratio_to_median).toBeGreaterThan(20);
    expect(r.series).toBe("harm");
    expect(r.flagged).toContain("2020-08");
  });

  it("does not raise the MODIS outage caveat for VIIRS-observed months", () => {
    expect(anomaliesFor(er, 2020, period).caveats.map((c) => c.code)).not.toContain("outage");
    expect(anomaliesFor(el62, 2020, period).caveats.map((c) => c.code)).toContain("outage");
  });
});

describe("compareRegions", () => {
  it("ranks harmonized regions by annual mean", () => {
    const r = compareRegions(
      [
        { country: "ar", entry: arIndex.regions.find((x) => x.id === "30")! },
        { country: "ar", entry: arIndex.regions.find((x) => x.id === "18")! },
      ],
      "annual_mean",
    );
    expect(r.ranking_allowed).toBe(true);
    expect(r.rows[0].value).toBeGreaterThanOrEqual(r.rows[1].value as number);
  });

  it("refuses an absolute ranking when a region is relative", () => {
    const r = compareRegions(
      [
        { country: "gr", entry: grIndex.regions.find((x) => x.id === "EL62")! },
        { country: "gr", entry: grIndex.regions.find((x) => x.id === "EL52")! },
      ],
      "annual_mean",
    );
    expect(r.ranking_allowed).toBe(false);
    expect(r.caveats.map((c) => c.code)).toContain("relative_mode");
  });
});

// burncal-w7p: outage only where the value depends on MODIS, anomaly threshold stated
describe("outage scope and anomaly threshold", () => {
  it("drops the Aqua outage from VIIRS-observed months and keeps it on MODIS ones", () => {
    const r = regionSeries(er, { from: "2020-08", to: "2020-08", aggregate: "month" }, period);
    expect(r.records[0]).not.toHaveProperty("outage");
    const a = anomaliesFor(er, 2020, period).months.find((m) => m.ym === "2020-08")!;
    expect(a).not.toHaveProperty("outage");
    const rel = regionSeries(el62, { from: "2020-08", to: "2020-08", aggregate: "month" }, period);
    expect(rel.records[0]).toMatchObject({ outage: true, outage_affects: "modis" });
  });

  it("states the threshold in series and anomaly results", () => {
    expect(regionSeries(er, { from: "2020-01", to: "2020-02", aggregate: "month" }, period).anomaly_definition)
      .toMatch(/baseline_p90/);
    expect(anomaliesFor(er, 2020, period).anomaly_definition).toMatch(/90th percentile/);
  });
});

// burncal-nmk: coverage in every result, clipped ranges explained
describe("coverage", () => {
  it("adds coverage and the S-NPP caveat to any result", () => {
    const r = withCoverage({ a: 1 }, period);
    expect(r.coverage).toEqual({ start: "2000-11", end: "2025-12" });
    expect(r.caveats.map((c) => c.code)).toEqual(["coverage"]);
    expect(r.caveats[0].message).toMatch(/S-NPP.*NOAA-20/);
  });

  it("clips a range that runs past the end", () => {
    const r = regionSeries(er, { from: "2025-11", to: "2026-03", aggregate: "month" }, period);
    expect(monthly(r).records.map((x) => x.ym)).toEqual(["2025-11", "2025-12"]);
    expect(r.returned).toEqual({ from: "2025-11", to: "2025-12" });
    expect(r.caveats.map((c) => c.code)).toContain("out_of_coverage");
  });

  it("returns an empty series with an explanation after the end", () => {
    const r = regionSeries(er, { from: "2026-05", to: "2026-10", aggregate: "month" }, period);
    expect(r.records).toEqual([]);
    expect(r.returned).toBeNull();
    expect(r.caveats.map((c) => c.code)).toContain("out_of_coverage");
    expect(anomaliesFor(er, 2026, period).caveats.map((c) => c.code)).toContain("out_of_coverage");
  });
});

// burncal-17x: fields, no nulls, yearly totals on the record series
describe("compact series", () => {
  it("omits nulls and honours fields", () => {
    const r = regionSeries(er, { from: "2020-01", to: "2020-03", aggregate: "month", fields: ["harm", "anom_pct"] }, period);
    expect(Object.keys(r.records[0]).sort()).toEqual(["anom_pct", "harm", "ym"]);
    const old = regionSeries(er, { from: "2005-01", to: "2005-01", aggregate: "month" }, period);
    expect(old.records[0]).not.toHaveProperty("viirs"); // null before 2012, dropped
  });

  it("gives calendar-year totals on harm, marking partial years", () => {
    const r = monthly(regionSeries(er, { from: "2019-07", to: "2020-12", aggregate: "month" }, period));
    expect(r.totals).toEqual([
      expect.objectContaining({ year: 2019, series: "harm", n_months: 6, partial: true }),
      expect.objectContaining({ year: 2020, series: "harm", n_months: 12, partial: false }),
    ]);
    const sum2020 = er.months.filter((m) => m.ym.startsWith("2020-")).reduce((a, m) => a + (m.harm ?? 0), 0);
    expect(r.totals[1].total).toBeCloseTo(sum2020, 0);
  });

  it("uses MODIS for totals in relative mode", () => {
    const r = monthly(regionSeries(el62, { from: "2020-01", to: "2020-12", aggregate: "month" }, period));
    expect(r.totals[0].series).toBe("modis");
  });
});

// burncal-j03: never mix MODIS and harmonized counts
describe("annual_mean by mode", () => {
  it("nulls annual_mean of relative regions and moves the raw value", () => {
    const r = searchRegions([grIndex], { query: "EL62", limit: 5 });
    expect(r.regions[0]).toMatchObject({ annual_mean: null, annual_mean_of: "modis" });
    expect(r.regions[0]).toHaveProperty("annual_mean_modis");
    expect(r.caveats.map((c) => c.code)).toContain("relative_mode");
  });

  it("keeps relative counts out of value in compare_regions", () => {
    const r = compareRegions(
      [
        { country: "gr", entry: grIndex.regions.find((x) => x.id === "EL62")! },
        { country: "gr", entry: grIndex.regions.find((x) => x.id === "EL52")! },
      ],
      "annual_mean",
    );
    const el62row = r.rows.find((x) => x.id === "EL62")!;
    expect(el62row.value).toBeUndefined();
    expect(el62row.value_modis).toBeGreaterThan(0);
  });
});

// burncal-zgm: find_region_at returns the region summary
describe("find_region_at", () => {
  const geo = {
    gr: read<RegionCollection>("gr/regions.geojson"),
    ar: read<RegionCollection>("ar/regions.geojson"),
  };

  it("finds Thessaloniki and Paraná", () => {
    expect(locate(geo, 40.64, 22.94)).toEqual({ found: true, country: "gr", id: "EL52" });
    expect(locate(geo, -31.73, -60.52)).toEqual({ found: true, country: "ar", id: "30" });
  });

  it("returns found false and no nearest region far at sea", () => {
    expect(locate(geo, 0, 0)).toEqual({ found: false, nearest: null });
  });

  it("returns the nearest region within 5 km just off the coast", () => {
    const m = locate(geo, NEAR_COAST.lat, NEAR_COAST.lon);
    expect(m.found).toBe(false);
    if (!m.found) {
      expect(m.nearest?.id).toBe(NEAR_COAST.id);
      expect(m.nearest!.distance_km).toBeLessThanOrEqual(5);
    }
  });

  it("summarises the region with climatology, last 3 season years and links", () => {
    const s = regionSummary("ar", arIndex.regions.find((x) => x.id === "30")!, er);
    expect(s).toMatchObject({ id: "30", mode: "harmonized", annual_mean_of: "harm" });
    expect(s.climatology).toHaveProperty("peak_month");
    expect(s.last_season_years).toHaveLength(3);
    expect(s.last_season_years[2]).toHaveProperty("total");
    expect(s.data_url).toBe("https://burning-calendar.vercel.app/data/v1/ar/regions/30.json");
  });
});
