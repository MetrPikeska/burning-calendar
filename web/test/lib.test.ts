import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectionDaysText, type IndexFile, type MonthRecord, type RegionFile } from "../src/lib/contract.ts";
import { buildReport, CITATION } from "../src/lib/report.ts";
import { csvFileName, filterCsvByRange } from "../src/lib/csv.ts";
import { parseLatLon, regionAt, type RegionCollection } from "../src/lib/geo.ts";

const gr = JSON.parse(readFileSync("public/data/v1/gr/regions.geojson", "utf8")) as RegionCollection;
const ar = JSON.parse(readFileSync("public/data/v1/ar/regions.geojson", "utf8")) as RegionCollection;

describe("regionAt", () => {
  it("finds the NUTS2 region for known cities", () => {
    expect(regionAt(gr, 22.94, 40.64)?.properties.id).toBe("EL52"); // Thessaloniki
    expect(regionAt(gr, 23.73, 37.98)?.properties.id).toBe("EL30"); // Athens
    expect(regionAt(gr, 22.42, 39.64)?.properties.id).toBe("EL61"); // Larissa
  });

  it("finds Argentine provinces", () => {
    expect(regionAt(ar, -64.18, -31.42)?.properties.id).toBe("14"); // Córdoba city
    expect(regionAt(ar, -60.64, -32.95)?.properties.id).toBe("82"); // Rosario, Santa Fe
  });

  it("returns null at sea", () => {
    expect(regionAt(gr, 25.0, 36.0)).toBeNull();
  });
});

describe("parseLatLon", () => {
  it("accepts common separators", () => {
    expect(parseLatLon("40.64, 22.94")).toEqual({ lat: 40.64, lon: 22.94 });
    expect(parseLatLon(" -34.6 ; -58.4 ")).toEqual({ lat: -34.6, lon: -58.4 });
  });
  it("rejects junk and out-of-range values", () => {
    expect(parseLatLon("Thessaloniki")).toBeNull();
    expect(parseLatLon("91, 10")).toBeNull();
    expect(parseLatLon("1, 2, 3")).toBeNull();
  });
});

describe("filterCsvByRange", () => {
  const csv = "region_id,mode,ym,modis\nEL52,harmonized,2007-07,3\nEL52,harmonized,2007-08,41\nEL52,harmonized,2007-09,5\n";
  it("keeps the header and the inclusive range", () => {
    expect(filterCsvByRange(csv, "2007-08", "2007-09")).toBe(
      "region_id,mode,ym,modis\nEL52,harmonized,2007-08,41\nEL52,harmonized,2007-09,5\n",
    );
  });
  it("treats null as an open bound", () => {
    expect(filterCsvByRange(csv, null, "2007-07").split("\n")).toHaveLength(3);
  });
  it("names the file after the range", () => {
    expect(csvFileName("gr", "EL52", "2007-01", null)).toBe("burning-calendar_gr_EL52_2007-01_end.csv");
  });
});

describe("defaultMonth", async () => {
  const { defaultMonth } = await import("../src/charts/median.ts");
  const entreRios = JSON.parse(readFileSync("public/data/v1/ar/regions/30.json", "utf8"));
  it("picks the strongest month in the range (Paraná 2020)", () => {
    expect(defaultMonth(entreRios, "2020-01", "2020-12")).toBe("2020-08");
  });
  it("without a range picks the strongest of the last 12 months, not the latest month", () => {
    expect(defaultMonth(entreRios, null, null)).toBe("2026-09");
  });
});

describe("detectionDaysText", () => {
  const rec = (o: Partial<MonthRecord>) => ({ ym: "2024-08", days_viirs: 18, days_modis: 8, ...o }) as MonthRecord;
  it("uses VIIRS days for observed months and the month length", () => {
    expect(detectionDaysText(rec({}), true)).toBe("VIIRS saw fire on 18 of 31 days");
    expect(detectionDaysText(rec({ ym: "2024-02", days_viirs: 3 }), true)).toBe("VIIRS saw fire on 3 of 29 days");
  });
  it("uses MODIS days for back-cast or relative months and gives null without data", () => {
    expect(detectionDaysText(rec({ ym: "2007-08", days_viirs: null, days_modis: 25 }), false)).toBe("MODIS saw fire on 25 of 31 days");
    expect(detectionDaysText(rec({ days_viirs: null }), true)).toBeNull();
  });
});

describe("buildReport", () => {
  const load = <T>(p: string) => JSON.parse(readFileSync(`public/data/v1/${p}`, "utf8")) as T;
  const grIndex = load<IndexFile>("gr/index.json");
  const base = { from: null, to: null, viewUrl: "https://example.test/?country=gr&region=EL52", csvUrl: "https://example.test/data/v1/gr/regions/EL52.csv", today: "2026-11-15" };

  it("quotes the month, its median, days and validation from the data", () => {
    const md = buildReport({ ...base, index: grIndex, region: load<RegionFile>("gr/regions/EL52.json"), ym: "2024-08" });
    expect(md).toMatch(/^# Burning calendar: Kentriki Makedonia \(EL52\)/);
    expect(md).toContain("| VIIRS-equivalent detections | 208 |");
    expect(md).toContain("| baseline median / 90th percentile | 19 / 33.9 |");
    expect(md).toContain("VIIRS saw fire on 18 of 31 days");
    expect(md).toMatch(/Leave-one-year-out 2012-2019: median absolute error of annual totals 4 %/);
    expect(md).toContain(CITATION);
    expect(md).not.toMatch(/undefined|NaN/);
  });

  it("gives the range for a back-cast month and flags small counts", () => {
    const el52 = load<RegionFile>("gr/regions/EL52.json");
    expect(buildReport({ ...base, index: grIndex, region: el52, ym: "2012-01" })).toMatch(/likely range \(10th-90th percentile of the back-cast check\) \| [\d.,]+ to [\d.,]+ \|/);
    expect(buildReport({ ...base, index: grIndex, region: el52, ym: "2024-05" })).toContain("fewer than 20 detections");
  });

  it("says relative mode and uses MODIS columns", () => {
    const md = buildReport({ ...base, index: grIndex, region: load<RegionFile>("gr/regions/EL62.json"), ym: "2021-08", from: "2021-01", to: "2021-12" });
    expect(md).toContain("mode: **relative**");
    expect(md).toContain("| month | MODIS | VIIRS | anomaly |");
    expect(md).toContain("## Monthly values, 2021-01 to 2021-12");
    expect(md.match(/^\| 2021-\d\d \|/gm)).toHaveLength(12);
  });
});
