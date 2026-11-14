// Runs an AOI: which regions it touches, their detections inside it, and the calendar for it.
// Greece only: Argentina has no published per-detection files (4.5 M rows), so an Argentine AOI
// lists the provinces it touches instead.
import type { CountryCode, IndexFile, RegionFile } from "../lib/contract.ts";
import type { RegionCollection } from "../lib/geo.ts";
import { type AoiResult, computeAoi, type Detection } from "./compute.ts";
import { DETECTIONS_HEADER, loadRegionDetections } from "./detections.ts";
import { type Aoi, aoiBbox, areaKm2, bboxesMeet, contains, padBbox, regionBboxes } from "./geojson.ts";

/** Band of the pipeline's region assignment (pipeline/regions.py, nearest region within 5 km). */
const ASSIGN_BAND_KM = 5;

export type AoiOutcome =
  | { kind: "calendar"; aoi: Aoi; area_km2: number; result: AoiResult; inside: Detection[] }
  | { kind: "no_points"; aoi: Aoi; area_km2: number; regions: { id: string; name: string }[] }
  | { kind: "outside"; aoi: Aoi; area_km2: number };

/** Regions (not the country itself) whose bbox meets the AOI bbox. */
export function touchedRegions(aoi: Aoi, geometry: RegionCollection, index: IndexFile): { id: string; name: string }[] {
  const box = aoiBbox(aoi);
  const boxes = regionBboxes(geometry);
  return index.regions
    // The pipeline assigns detections up to 5 km off a region's polygon, so its file can hold points outside the
    // map outline; grow each region box by that band before choosing which files to load (audit P1-03).
    .filter((r) => r.level !== "country" && boxes.has(r.id) && bboxesMeet(box, padBbox(boxes.get(r.id)!, ASSIGN_BAND_KM)))
    .map((r) => ({ id: r.id, name: r.name }));
}

export async function runAoi(aoi: Aoi, country: CountryCode, geometry: RegionCollection, index: IndexFile,
                             loadRegion: (id: string) => Promise<RegionFile>): Promise<AoiOutcome> {
  const area_km2 = areaKm2(aoi);
  const regions = touchedRegions(aoi, geometry, index);
  if (!regions.length) return { kind: "outside", aoi, area_km2 };
  if (country !== "gr") return { kind: "no_points", aoi, area_km2, regions };
  const ids = regions.map((r) => r.id);
  const [perRegion, files, reference] = await Promise.all([
    Promise.all(ids.map(loadRegionDetections)),
    Promise.all(ids.map(loadRegion)),
    loadRegion("GR"),
  ]);
  const inside = perRegion.flat().filter((d) => contains(aoi, d.lon, d.lat));
  const withPoints = [...new Set(inside.map((d) => d.region_id))];
  const fileById = new Map(files.map((f) => [f.id, f]));
  // The mode follows the regions that hold detections in the area; with none, every touched region.
  const result = computeAoi(inside, withPoints.length ? withPoints : ids, fileById, reference, index.period.end, "Your area");
  return { kind: "calendar", aoi, area_km2, result, inside };
}

/** Same columns as the pipeline's regions/{id}.csv (pipeline/export.py CSV_FIELDS). */
const CSV_FIELDS = ["ym", "modis", "viirs", "harm", "harm_lo", "harm_hi", "src", "fit_level", "anom_pct", "anom",
  "outage_days", "outage", "baseline_median", "baseline_p90", "baseline_years", "days_modis", "days_viirs",
  "outage_days_viirs", "outage_viirs", "provisional"] as const;

/** Monthly CSV of the area: the pipeline's columns plus aoi_estimate, "unvalidated" on every back-cast month
 *  (region factors applied to an area they were not validated for, audit BC3-003). */
export function monthsCsv(file: RegionFile): string {
  const rows = file.months.map((m) => [file.id, file.mode, ...CSV_FIELDS.map((k) => {
    const v = (m as unknown as Record<string, unknown>)[k];
    return v === null || v === undefined ? "" : String(v);
  }), file.mode === "harmonized" && m.src !== "observed" ? "unvalidated" : ""].join(","));
  return ["region_id,mode," + CSV_FIELDS.join(",") + ",aoi_estimate", ...rows].join("\n") + "\n";
}

/** The detections inside the AOI, in the published CSV format (region_id is each detection's region). */
export function detectionsCsv(inside: Detection[]): string {
  return [DETECTIONS_HEADER, ...inside.map((d) => d.line)].join("\n") + "\n";
}
