import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile, RegionFile } from "../src/lib/contract.ts";
import type { RegionCollection } from "../src/lib/geo.ts";
import {
  aggregate,
  anomaliesFor,
  compactCaveats,
  compareRegions,
  countriesIn,
  countryOf,
  locate,
  rankRegions,
  regionSummary,
  regionSeries,
  searchRegions,
  seasonWindow,
  seasonCalendar,
  validationFor,
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

describe("countriesIn", () => {
  it("finds the countries a result covers, for the source links", () => {
    expect(countriesIn(anomaliesFor(el62, 2021, period))).toEqual(["gr"]);
    expect(countriesIn(anomaliesFor(er, 2020, period))).toEqual(["ar"]);
    expect(countriesIn(searchRegions([grIndex, arIndex], { limit: 50 }))).toEqual(["gr", "ar"]);
    expect(countriesIn(searchRegions([grIndex, arIndex], { country: "AR", limit: 50 }))).toEqual(["ar"]);
  });

  it("falls back to both countries when a result names none", () => {
    expect(countriesIn({ topic: "overview", text: "..." })).toEqual(["gr", "ar"]);
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

// burncal-ytn: area and density
describe("area and density", () => {
  it("exposes area_km2 and density for harmonized regions", () => {
    const r = searchRegions([arIndex], { query: "30", limit: 1 }).regions[0];
    expect(r.area_km2).toBeGreaterThan(75000); // Entre Ríos about 78,800 km2
    expect(r.area_km2).toBeLessThan(82000);
    expect(r.density_per_1000km2).toBeCloseTo((1000 * (r.annual_mean as number)) / (r.area_km2 as number), 1);
  });

  it("moves density of relative regions to density_modis_per_1000km2", () => {
    const r = searchRegions([grIndex], { query: "EL62", limit: 1 }).regions[0];
    expect(r.density_per_1000km2).toBeNull();
    expect(r).toHaveProperty("density_modis_per_1000km2");
  });

  it("ranks by density only over harmonized regions", () => {
    const entry = (ix: IndexFile, id: string) => ix.regions.find((x) => x.id === id)!;
    const ok = compareRegions([{ country: "ar", entry: entry(arIndex, "06") }, { country: "ar", entry: entry(arIndex, "34") }],
      "density_per_1000km2");
    expect(ok.ranking_allowed).toBe(true);
    expect(ok.rows[0].id).toBe("34"); // Formosa is denser than Buenos Aires
    const mixed = compareRegions([{ country: "gr", entry: entry(grIndex, "EL62") }, { country: "gr", entry: entry(grIndex, "EL52") }],
      "density_per_1000km2");
    expect(mixed.ranking_allowed).toBe(false);
  });
});

// burncal-mpw: ranking over many regions
describe("rankRegions", () => {
  const all = [
    ...grIndex.regions.filter((r) => r.level !== "country").map((entry) => ({ country: "gr" as const, entry })),
    ...arIndex.regions.filter((r) => r.level !== "country").map((entry) => ({ country: "ar" as const, entry })),
  ];

  it("ranks harmonized regions by density and lists relative ones apart", () => {
    const r = rankRegions(all, "density_per_1000km2", { top: 5, order: "desc" });
    expect(r.ranked).toHaveLength(5);
    expect(r.ranked[0]).toMatchObject({ rank: 1, id: "34" }); // Formosa
    expect(r.ranked.every((x) => x.mode === "harmonized")).toBe(true);
    expect(r.excluded_relative.map((x) => x.id).sort()).toEqual(["02", "58", "94", "EL62"]);
    expect(r.caveats.map((c) => c.code)).toContain("relative_mode");
  });

  it("ranks season totals for a year from region files", () => {
    const items = ["30", "18", "14"].map((id) => ({
      country: "ar" as const,
      entry: arIndex.regions.find((x) => x.id === id)!,
      region: read<RegionFile>(`ar/regions/${id}.json`),
    }));
    const r = rankRegions(items, "season_total", { year: 2020, top: 10, order: "desc" });
    expect(r.ranked.map((x) => x.value)).toEqual([...r.ranked.map((x) => x.value)].sort((a, b) => (b as number) - (a as number)));
    expect(() => rankRegions(items, "season_total", { top: 10, order: "desc" })).toThrow(/year/);
  });

  it("does not exclude relative regions for non-count metrics", () => {
    const r = rankRegions(all, "loyo_mdape_pct", { top: 50, order: "asc" });
    expect(r.excluded_relative).toEqual([]);
    expect(r.ranked[0].value).toBeLessThanOrEqual(r.ranked[1].value as number);
  });
});

// burncal-x34: days with a detection
describe("days with a detection", () => {
  it("returns days_viirs / days_modis via fields and in anomalies", () => {
    const r = regionSeries(er, { from: "2020-08", to: "2020-08", aggregate: "month", fields: ["days_viirs", "days_modis"] }, period);
    expect(r.records[0]).toEqual({ ym: "2020-08", days_modis: 30, days_viirs: 30 });
    const a = anomaliesFor(er, 2020, period).months.find((m) => m.ym === "2020-08")!;
    expect(a.days_viirs).toBe(30);
    const old = regionSeries(er, { from: "2005-08", to: "2005-08", aggregate: "month", fields: ["days_viirs", "days_modis"] }, period);
    expect(old.records[0]).not.toHaveProperty("days_viirs"); // null before 2012, dropped
  });
});

// burncal-cis: aggregation over a period and regions
describe("aggregate", () => {
  const ar18 = read<RegionFile>("ar/regions/18.json");
  const sum = (r: RegionFile, k: "harm" | "modis", from: string, to: string) =>
    r.months.filter((m) => m.ym >= from && m.ym <= to).reduce((a, m) => a + ((m[k] as number | null) ?? 0), 0);

  it("sums harm over a period per region and overall, with top months", () => {
    const r = aggregate([er, ar18], { from: "2020-01", to: "2022-12", top: 3 }, period);
    expect(r.series).toBe("harm");
    expect(r.regions.find((x) => x.id === "30")!.total).toBeCloseTo(sum(er, "harm", "2020-01", "2022-12"), 0);
    expect(r.total).toBeCloseTo(sum(er, "harm", "2020-01", "2022-12") + sum(ar18, "harm", "2020-01", "2022-12"), 0);
    expect(r.top_months).toHaveLength(3);
    expect(r.top_months[0].total).toBeGreaterThanOrEqual(r.top_months[1].total);
  });

  it("falls back to MODIS when a region is relative", () => {
    const r = aggregate([er, el62], { from: "2020-01", to: "2020-12", top: 3 }, period);
    expect(r.series).toBe("modis");
    expect(r.caveats.map((c) => c.code)).toContain("relative_mode");
  });

  it("refuses to add a country to its own regions", () => {
    const ar = read<RegionFile>("ar/regions/AR.json");
    expect(() => aggregate([ar, er], { from: "2020-01", to: "2020-12", top: 3 }, period)).toThrow(/double/);
  });

  it("clips to coverage", () => {
    const r = aggregate([er], { from: "2025-06", to: "2026-06", top: 3 }, period);
    expect(r.regions[0].n_months).toBe(7);
    expect(r.caveats.map((c) => c.code)).toContain("out_of_coverage");
  });
});

// burncal-n8a: validation details
describe("validationFor", () => {
  it("returns per-year LOYO and time-split errors, band and mode reasons for a region", () => {
    const v = validationFor(el62);
    expect(v.mode).toBe("relative");
    expect(v.mode_reasons[0]).toMatch(/loyo_mdape/);
    expect(Object.keys(v.loyo.annual_err_pct)).toEqual(["2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019"]);
    expect(v.loyo.abs_err_summary.median).toBeCloseTo(v.loyo.annual_mdape_pct as number, 0); // per-year errors are rounded
    expect(v.time_split.annual_err_pct).toHaveProperty("2023");
    expect(v.band).toHaveLength(12);
    expect(v.rule).toMatch(/25 %/);
  });

  it("adds a table of all regions for a country", () => {
    const ar = read<RegionFile>("ar/regions/AR.json");
    const cv = read<{ static_filter: object; assignment: object; regions: Record<string, unknown> }>("ar/validation.json");
    const v = validationFor(ar, { validation: cv, index: arIndex });
    expect(v.regions).toHaveLength(24);
    const row = v.regions!.find((r) => r.id === "58")!;
    expect(row).toMatchObject({ name: "Neuquén", mode: "relative" });
    expect(row.loyo_mdape_pct).toBeGreaterThan(25);
    expect(v.static_filter).toBeDefined();
  });
});

// burncal-sgu: compact caveats
describe("compactCaveats", () => {
  it("replaces caveat texts by unique codes", () => {
    const full = withCoverage(regionSeries(er, { from: "2005-01", to: "2005-03", aggregate: "month" }, period), period);
    const c = compactCaveats(full);
    expect(c).not.toHaveProperty("caveats");
    expect(c.caveat_codes).toEqual(["backcast", "detections_not_fires", "coverage"]);
    expect(c.records).toEqual(full.records);
  });
});

// burncal-a0t: season windows in season_total rankings
describe("season windows", () => {
  it("maps a season year to its 12 months", () => {
    expect(seasonWindow(12, 2020)).toEqual({ from: "2019-12", to: "2020-11" });
    expect(seasonWindow(1, 2020)).toEqual({ from: "2020-01", to: "2020-12" });
    expect(seasonWindow(4, 2020)).toEqual({ from: "2020-04", to: "2021-03" });
    expect(seasonWindow(8, 2020)).toEqual({ from: "2019-08", to: "2020-07" });
  });

  it("matches the season total of Santa Fe 2020", () => {
    const sf = read<RegionFile>("ar/regions/82.json");
    const w = seasonWindow(sf.summary.season_start_month, 2020);
    const sum = sf.months.filter((m) => m.ym >= w.from && m.ym <= w.to).reduce((a, m) => a + (m.harm ?? 0), 0);
    expect(sum).toBeCloseTo(sf.years.find((y) => y.season_year === 2020)!.total, 0);
  });

  it("puts season_window on each ranked row and warns when windows differ", () => {
    const items = ["82", "30", "22"].map((id) => ({
      country: "ar" as const, entry: arIndex.regions.find((x) => x.id === id)!, region: read<RegionFile>(`ar/regions/${id}.json`),
    }));
    const r = rankRegions(items, "season_total", { year: 2020, top: 10, order: "desc" });
    expect(r.ranked[0]).toHaveProperty("season_window");
    const windows = new Set(r.ranked.map((x) => JSON.stringify((x as { season_window?: unknown }).season_window)));
    if (windows.size > 1) expect(r.caveats.map((c) => c.code)).toContain("season_window");
  });
});
