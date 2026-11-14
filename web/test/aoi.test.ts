// AOI: the client-side port of the pipeline must reproduce a region's months from its own detections.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile, RegionFile } from "../src/lib/contract.ts";
import { computeAoi, type Detection } from "../src/aoi/compute.ts";
import { DETECTIONS_HEADER, parseDetectionsCsv } from "../src/aoi/detections.ts";
import { aoiBbox, aoiToGeoJson, AoiError, areaKm2, contains, emptyAoi, parseGeoJson, ringSelfIntersects, sphericalRingAreaKm2 } from "../src/aoi/geojson.ts";
import { detectionsCsv, monthsCsv, touchedRegions } from "../src/aoi/run.ts";
import { distanceToLineKm, inPolygon, type RegionCollection } from "../src/lib/geo.ts";

const read = <T>(p: string) => JSON.parse(readFileSync(`public/data/v1/${p}`, "utf8")) as T;
const index = read<IndexFile>("gr/index.json");
const region = (id: string) => read<RegionFile>(`gr/regions/${id}.json`);
const dets = (id: string): Detection[] => parseDetectionsCsv(readFileSync(`public/data/v1/gr/detections/${id}.csv`, "utf8"));
const GR = region("GR");

function aoiOf(ids: string[]) {
  const files = new Map(ids.map((id) => [id, region(id)]));
  return computeAoi(ids.flatMap(dets), ids, files, GR, index.period.end);
}

describe("AOI = one region reproduces the pipeline", () => {
  for (const id of ["EL52", "EL64", "EL62", "EL30"]) {
    it(id, () => {
      const want = region(id);
      const got = aoiOf([id]).file;
      expect(got.mode).toBe(want.mode);
      expect(got.months.length).toBe(want.months.length);
      const bad: string[] = [];
      got.months.forEach((g, i) => {
        const w = want.months[i];
        const near = (a: number | null, b: number | null, tol: number) =>
          a === null || b === null ? a === b : Math.abs(a - b) <= tol + 1e-3 * Math.abs(b);
        const checks: [string, boolean][] = [
          ["ym", g.ym === w.ym], ["modis", g.modis === w.modis], ["viirs", g.viirs === w.viirs], ["src", g.src === w.src],
          ["harm", near(g.harm, w.harm, 0.1)], ["harm_lo", near(g.harm_lo, w.harm_lo, 0.1)], ["harm_hi", near(g.harm_hi, w.harm_hi, 0.1)],
          ["baseline_median", near(g.baseline_median, w.baseline_median, 0.1)], ["baseline_p90", near(g.baseline_p90, w.baseline_p90, 0.1)],
          ["anom_pct", near(g.anom_pct, w.anom_pct, 0.1)], ["anom", g.anom === w.anom], ["baseline_years", g.baseline_years === w.baseline_years],
          ["days_modis", g.days_modis === w.days_modis], ["days_viirs", g.days_viirs === w.days_viirs],
          ["outage", g.outage === w.outage], ["provisional", g.provisional === w.provisional],
        ];
        for (const [k, ok] of checks) if (!ok) bad.push(`${w.ym} ${k}: ${JSON.stringify((g as never)[k])} vs ${JSON.stringify((w as never)[k])}`);
      });
      expect(bad.slice(0, 12)).toEqual([]);
      expect(got.summary).toEqual(want.summary);
      expect(got.years.map((y) => [y.season_year, y.onset, y.end, y.peak_month])).toEqual(want.years.map((y) => [y.season_year, y.onset, y.end, y.peak_month]));
    });
  }
});

describe("AOI across regions", () => {
  it("EL52 + EL51 gives the sum of their harm month by month", () => {
    const both = aoiOf(["EL52", "EL51"]).file;
    const a = region("EL52"), b = region("EL51");
    both.months.forEach((m, i) => {
      expect(m.harm!).toBeCloseTo(a.months[i].harm! + b.months[i].harm!, 0);
      expect(m.modis).toBe(a.months[i].modis + b.months[i].modis);
    });
  });

  it("switches to raw MODIS when a relative region is inside (EL62 + EL54)", () => {
    const r = aoiOf(["EL62", "EL54"]);
    expect(r.file.mode).toBe("relative");
    expect(r.file.months.every((m) => m.harm === null)).toBe(true);
    expect(r.regions.map((x) => x.id).sort()).toEqual(["EL54", "EL62"]);
  });

  it("an area without detections gives zeros, not an error", () => {
    const r = computeAoi([], ["EL52"], new Map([["EL52", region("EL52")]]), GR, index.period.end);
    expect(r.detections).toBe(0);
    expect(r.file.months.every((m) => m.modis === 0)).toBe(true);
  });
});

describe("AOI geometry and GeoJSON", () => {
  const square = [[22, 38], [24, 38], [24, 40], [22, 40], [22, 38]];
  const hole = [[22.5, 38.5], [23.5, 38.5], [23.5, 39.5], [22.5, 39.5], [22.5, 38.5]];

  it("reads Feature, FeatureCollection, MultiPolygon, Point and LineString", () => {
    expect(parseGeoJson(JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [square] } })).polygons).toHaveLength(1);
    const fc = parseGeoJson(JSON.stringify({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "MultiPolygon", coordinates: [[square], [hole]] } },
      { type: "Feature", geometry: { type: "Point", coordinates: [23, 39] } },
      { type: "Feature", geometry: { type: "LineString", coordinates: [[22, 38], [23, 39]] } },
    ] }), 3);
    expect([fc.polygons.length, fc.points.length, fc.lines.length, fc.radius_km]).toEqual([2, 1, 1, 3]);
    expect(parseGeoJson(JSON.stringify({ type: "Polygon", coordinates: [square] })).polygons).toHaveLength(1);
  });

  it("round-trips its own export: same parts, radius, area and containment (audit R2-002)", () => {
    for (const radius_km of [2, 5, 50]) {
      const a = { polygons: [[square]], points: [[23, 39]], lines: [[[22, 38], [24, 38]]], radius_km };
      let b = a;
      for (let i = 0; i < 3; i++) b = parseGeoJson(JSON.stringify(aoiToGeoJson(b)), 5); // picker at 5 km
      expect([b.polygons.length, b.points.length, b.lines.length, b.radius_km]).toEqual([1, 1, 1, radius_km]);
      expect(areaKm2(b)).toBeCloseTo(areaKm2(a), 6);
      for (const [lon, lat] of [[23.03, 39], [23.04, 39.0], [23.05, 38.0], [25, 41]]) expect(contains(b, lon, lat)).toBe(contains(a, lon, lat));
    }
    // A foreign file without radius_km takes the picker radius.
    expect(parseGeoJson(JSON.stringify({ type: "Point", coordinates: [23, 39] }), 3).radius_km).toBe(3);
  });

  it("rejects broken, empty, projected and oversized input with a readable message", () => {
    expect(() => parseGeoJson("{nope")).toThrow(AoiError);
    expect(() => parseGeoJson(JSON.stringify({ type: "FeatureCollection", features: [] }))).toThrow(/no polygon, point or line/);
    expect(() => parseGeoJson(JSON.stringify({ type: "Feature", crs: { properties: { name: "urn:ogc:def:crs:EPSG::2100" } }, geometry: { type: "Point", coordinates: [23, 39] } }))).toThrow(/WGS 84/);
    expect(() => parseGeoJson(JSON.stringify({ type: "Point", coordinates: [500000, 4300000] }))).toThrow(/lon\/lat/);
    expect(() => parseGeoJson(" ".repeat(5 * 1024 * 1024 + 1))).toThrow(/5 MB/);
    const ring = Array.from({ length: 20001 }, (_, i) => [22 + i / 1e5, 38 + (i % 2) / 100]);
    expect(() => parseGeoJson(JSON.stringify({ type: "Polygon", coordinates: [[...ring, ring[0]]] }))).toThrow(/vertices/);
  });

  it("tests points against holes, radii and lines", () => {
    expect(inPolygon(22.2, 38.2, [square, hole])).toBe(true);
    expect(inPolygon(23, 39, [square, hole])).toBe(false);
    const a = { polygons: [], points: [[23, 39]], lines: [[[22, 38], [24, 38]]], radius_km: 5 };
    expect(contains(a, 23.03, 39)).toBe(true); // about 2.6 km east of the point
    expect(contains(a, 23.1, 39)).toBe(false); // about 8.7 km
    expect(distanceToLineKm(23, 38.04, [[22, 38], [24, 38]])).toBeCloseTo(4.4, 1);
    expect(contains(a, 23, 38.04)).toBe(true);
    const [w, s, e, n] = aoiBbox(a);
    expect(w).toBeLessThan(22);
    expect(n).toBeGreaterThan(39);
    expect([s, e].every(Number.isFinite)).toBe(true);
    expect(areaKm2({ polygons: [], points: [[23, 39]], lines: [], radius_km: 5 })).toBeCloseTo(78.5, 0);
    expect(aoiToGeoJson(a).features.map((f) => (f as { properties: { role: string } }).properties.role)).toEqual(["point", "point-buffer", "line"]);
  });

  it("finds the Greek regions an area touches by bbox", () => {
    const geo = read<RegionCollection>("gr/regions.geojson");
    const evia = parseGeoJson(readFileSync("test/fixtures/evia-north.geojson", "utf8"));
    const ids = touchedRegions(evia, geo, index).map((r) => r.id);
    expect(ids).toContain("EL64");
    expect(ids).not.toContain("GR");
    const atSea = parseGeoJson(JSON.stringify({ type: "Point", coordinates: [10, 30] }));
    expect(touchedRegions(atSea, geo, index)).toEqual([]);
  });
});

describe("AOI downloads", () => {
  it("monthly CSV keeps the pipeline's columns; detections CSV keeps the published rows", () => {
    const r = aoiOf(["EL64"]);
    const csv = monthsCsv(r.file);
    expect(csv.split("\n")[0]).toBe(readFileSync("public/data/v1/gr/regions/EL64.csv", "utf8").split("\n")[0] + ",aoi_estimate");
    expect(csv.split("\n").find((l) => l.startsWith("AOI,harmonized,2005-08,"))!.endsWith(",unvalidated")).toBe(true);
    expect(csv.split("\n").find((l) => l.startsWith("AOI,harmonized,2021-08,"))!.endsWith(",")).toBe(true);
    const aug = csv.split("\n").find((l) => l.startsWith("AOI,harmonized,2021-08,"))!;
    expect(aug.split(",")[5]).toBe("4235");
    const d = dets("EL64").slice(0, 3);
    expect(detectionsCsv(d).split("\n").slice(0, 4)).toEqual([DETECTIONS_HEADER, ...d.map((x) => x.line)]);
  });
});

describe("AOI area is the union of its parts (audit BC3-001)", () => {
  const disc = Math.PI * 25;
  it("two identical 5 km discs give one disc, not two", () => {
    const a = { ...emptyAoi(5), points: [[23, 39], [23, 39]] };
    expect(Math.abs(areaKm2(a) - disc) / disc).toBeLessThan(0.01);
  });

  it("two discs one radius apart give 2 pi r2 minus their lens", () => {
    const r = 5, d = 5;
    const lens = 2 * r * r * Math.acos(d / (2 * r)) - (d / 2) * Math.sqrt(4 * r * r - d * d);
    const want = 2 * disc - lens;
    const dLon = d / (111.32 * Math.cos((39 * Math.PI) / 180));
    const a = { ...emptyAoi(5), points: [[23, 39], [23 + dLon, 39]] };
    expect(Math.abs(areaKm2(a) - want) / want).toBeLessThan(0.01);
  });

  it("a disc inside a polygon adds nothing; a hole is subtracted", () => {
    const sq = [[22, 38], [24, 38], [24, 40], [22, 40], [22, 38]];
    const hole = [[22.5, 38.5], [23.5, 38.5], [23.5, 39.5], [22.5, 39.5], [22.5, 38.5]];
    const poly = sphericalRingAreaKm2(sq);
    const withDisc = areaKm2({ ...emptyAoi(5), polygons: [[sq]], points: [[23, 39]] });
    expect(Math.abs(withDisc - poly) / poly).toBeLessThan(0.01);
    expect(areaKm2({ ...emptyAoi(5), polygons: [[sq, hole]] })).toBeCloseTo(poly - sphericalRingAreaKm2(hole), 6);
  });

  it("the spherical area of EL64's map outline is close to the pipeline's EPSG:6933 area", () => {
    const geo = read<RegionCollection>("gr/regions.geojson");
    const f = geo.features.find((x) => x.properties.id === "EL64")!;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const ours = polys.reduce((t, p) => t + sphericalRingAreaKm2(p[0]) - p.slice(1).reduce((u, h) => u + sphericalRingAreaKm2(h), 0), 0);
    const ref = index.regions.find((r) => r.id === "EL64")!.area_km2!;
    expect(Math.abs(ours - ref) / ref).toBeLessThan(0.05); // 1:20M map outline vs 1:1M assignment polygons
  });
});

describe("GeoJSON topology (audit BC3-008)", () => {
  it("rejects an unclosed ring and a bowtie, accepts a plain square", () => {
    const open = [[22, 38], [24, 38], [24, 40], [22, 40], [22.1, 38.1]];
    expect(() => parseGeoJson(JSON.stringify({ type: "Polygon", coordinates: [open] }))).toThrow(/not closed/);
    const bowtie = [[22, 38], [24, 40], [24, 38], [22, 40], [22, 38]];
    expect(ringSelfIntersects(bowtie)).toBe(true);
    expect(() => parseGeoJson(JSON.stringify({ type: "Polygon", coordinates: [bowtie] }))).toThrow(/cross/);
    expect(ringSelfIntersects([[22, 38], [24, 38], [24, 40], [22, 40], [22, 38]])).toBe(false);
  });
});
