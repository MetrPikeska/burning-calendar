import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile, RegionFile } from "../src/lib/contract.ts";
import type { RegionCollection } from "../src/lib/geo.ts";
import {
  anomaliesFor,
  compareRegions,
  countryOf,
  findRegionAt,
  regionSeries,
  searchRegions,
  seasonCalendar,
  viewUrl,
} from "../api/_lib/tools.ts";

const read = <T>(p: string) => JSON.parse(readFileSync(`public/data/v1/${p}`, "utf8")) as T;
const grIndex = read<IndexFile>("gr/index.json");
const arIndex = read<IndexFile>("ar/index.json");
const er = read<RegionFile>("ar/regions/30.json"); // Entre Ríos, harmonized
const el62 = read<RegionFile>("gr/regions/EL62.json"); // Ionia Nisia, relative

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
    const r = regionSeries(er, { from: "2010-06", to: "2012-03", aggregate: "month" });
    expect(r.records).toHaveLength(22);
    expect(r.records[0]).toMatchObject({ ym: "2010-06", src: "backcast" });
    expect(r.caveats.map((c) => c.code)).toContain("backcast");
    expect(r.csv_url).toBe("https://burning-calendar.vercel.app/data/v1/ar/regions/30.csv");
  });

  it("refuses more than 120 monthly records", () => {
    expect(() => regionSeries(er, { from: "2001-01", to: "2025-12", aggregate: "month" })).toThrow(/120/);
  });

  it("aggregates calendar years", () => {
    const r = regionSeries(er, { from: "2019-01", to: "2020-12", aggregate: "year" });
    const rows = r.records as { year: number; viirs: number | null }[];
    expect(rows.map((x) => x.year)).toEqual([2019, 2020]);
    expect(rows[1].viirs).toBeGreaterThan(30000);
  });

  it("flags relative mode and leaves harm null", () => {
    const r = regionSeries(el62, { from: "2020-01", to: "2020-12", aggregate: "month" });
    expect(r.caveats[0].code).toBe("relative_mode");
    expect(r.records.every((x) => x.harm === null)).toBe(true);
  });
});

describe("seasonCalendar", () => {
  it("returns climatology and one season year", () => {
    const r = seasonCalendar(er, 2020);
    expect(r.climatology.season_start_month).toBe(er.summary.season_start_month);
    expect(r.years).toHaveLength(1);
    expect(r.years[0].season_year).toBe(2020);
  });
});

describe("anomaliesFor", () => {
  it("compares each month with its baseline median", () => {
    const r = anomaliesFor(er, 2020);
    const aug = r.months.find((m) => m.ym === "2020-08")!;
    expect(aug.anom).toBe(true);
    expect(aug.baseline_years).toBe("2010-2019");
    expect(aug.ratio_to_median).toBeGreaterThan(20);
    expect(r.series).toBe("harm");
    expect(r.flagged).toContain("2020-08");
  });

  it("does not raise the MODIS outage caveat for VIIRS-observed months", () => {
    expect(anomaliesFor(er, 2020).caveats.map((c) => c.code)).not.toContain("outage");
    expect(anomaliesFor(el62, 2020).caveats.map((c) => c.code)).toContain("outage");
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

describe("findRegionAt", () => {
  const geo = {
    gr: read<RegionCollection>("gr/regions.geojson"),
    ar: read<RegionCollection>("ar/regions.geojson"),
  };
  const idx = { gr: grIndex, ar: arIndex };

  it("finds Thessaloniki and Paraná", () => {
    expect(findRegionAt(geo, idx, 40.64, 22.94)).toMatchObject({ found: true, id: "EL52" });
    expect(findRegionAt(geo, idx, -31.73, -60.52)).toMatchObject({ found: true, id: "30" });
  });

  it("returns found false at sea", () => {
    expect(findRegionAt(geo, idx, 0, 0)).toEqual({ found: false });
  });
});
