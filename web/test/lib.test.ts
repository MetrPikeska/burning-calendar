import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
    expect(defaultMonth(entreRios, null, null)).toBe("2025-08");
  });
});
