// Region geometry and calendar data for the live tools, read from the same bundled public/data/v1 files as api/mcp.ts.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CountryCode, IndexFile, IndexRegion, RegionFile } from "../../../src/lib/contract.ts";
import { regionAt, type RegionCollection, type RegionFeature } from "../../../src/lib/geo.ts";
import { countryOf, viewUrl } from "../tools.ts";
import { cleanText } from "./core.ts";

// Same lookup as api/mcp.ts: CLI deploy from web/ vs Git deploy with root web/; locally cwd is web/.
const DATA_DIR =
  [join(process.cwd(), "public", "data", "v1"), join(process.cwd(), "web", "public", "data", "v1")].find((d) =>
    existsSync(join(d, "gr", "index.json")),
  ) ?? join(process.cwd(), "public", "data", "v1");

const files = new Map<string, Promise<unknown>>();
function loadJson<T>(rel: string): Promise<T> {
  if (!files.has(rel)) files.set(rel, readFile(join(DATA_DIR, rel), "utf8").then((s) => JSON.parse(s)));
  return files.get(rel) as Promise<T>;
}
// Same 1:1M-based geometry as find_region_at (regions_mcp.geojson, burncal-x9p), so a point gets the same region in every tool.
export const loadGeo = (c: CountryCode) => loadJson<RegionCollection>(`${c}/regions_mcp.geojson`);
const loadIndex = (c: CountryCode) => loadJson<IndexFile>(`${c}/index.json`);
export const loadRegionFile = (c: CountryCode, id: string) => loadJson<RegionFile>(`${c}/regions/${id}.json`);

export const COUNTRY_NAME: Record<CountryCode, string> = { gr: "Greece", ar: "Argentina" };

export interface LiveRegion {
  id: string;
  name: string;
  country: CountryCode;
  level: IndexRegion["level"];
  entry: IndexRegion;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  /** A point inside the region (centroid of its largest polygon when that lies inside). */
  point: { lat: number; lon: number };
  /** Polygons of the region; for a country all its regions. */
  features: RegionFeature[];
  view_url: string;
}

type Ring = number[][];
const polygonsOf = (f: RegionFeature): Ring[][] => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return a / 2;
}

function ringCentroid(r: Ring): [number, number] {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    cx += (r[j][0] + r[i][0]) * f;
    cy += (r[j][1] + r[i][1]) * f;
    a += f;
  }
  return a === 0 ? [r[0][0], r[0][1]] : [cx / (3 * a), cy / (3 * a)];
}

export function bboxOf(features: RegionFeature[]): [number, number, number, number] {
  let w = 180, s = 90, e = -180, n = -90;
  for (const f of features) for (const p of polygonsOf(f)) for (const [x, y] of p[0]) {
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  return [w, s, e, n];
}

/** Centroid of the largest outer ring; if it falls outside (concave shapes, islands), the ring's first vertex. */
export function representativePoint(features: RegionFeature[]): { lat: number; lon: number } {
  let best: Ring | null = null;
  let bestArea = -1;
  for (const f of features) for (const p of polygonsOf(f)) {
    const a = Math.abs(ringArea(p[0]));
    if (a > bestArea) { bestArea = a; best = p[0]; }
  }
  if (!best) return { lat: 0, lon: 0 };
  const [lon, lat] = ringCentroid(best);
  const fc: RegionCollection = { type: "FeatureCollection", features };
  if (regionAt(fc, lon, lat)) return { lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 };
  return { lat: best[0][1], lon: best[0][0] };
}

/** Region by id with geometry; throws a user-facing message for unknown ids. */
export async function resolveRegion(id: string): Promise<LiveRegion> {
  const country = countryOf(id);
  const entry = country ? (await loadIndex(country)).regions.find((r) => r.id === id) : undefined;
  if (!country || !entry) {
    throw new Error(`Unknown region_id "${id}". Use search_regions to list ids (Greece: GR, EL30..EL65; Argentina: AR, 02..94).`);
  }
  const geo = await loadGeo(country);
  const features = entry.level === "country" ? geo.features : geo.features.filter((f) => f.properties.id === id);
  if (!features.length) throw new Error(`No geometry for region_id "${id}".`);
  return {
    id, name: cleanText(entry.name, 80), country, level: entry.level, entry,
    bbox: bboxOf(features), point: representativePoint(features), features,
    view_url: viewUrl(country, entry.level === "country" ? null : id),
  };
}

/** Region (id, name) of a point within one country, or null. */
export async function regionOfPoint(country: CountryCode, lat: number, lon: number): Promise<{ id: string; name: string } | null> {
  const f = regionAt(await loadGeo(country), lon, lat);
  return f ? { id: f.properties.id, name: cleanText(f.properties.name, 80) } : null;
}

/** Region of a point in either country (for lat/lon input). */
export async function findRegion(lat: number, lon: number): Promise<{ id: string; name: string; country: CountryCode } | null> {
  for (const c of ["gr", "ar"] as const) {
    const r = await regionOfPoint(c, lat, lon);
    if (r) return { ...r, country: c };
  }
  return null;
}

export function inFeatures(features: RegionFeature[], lat: number, lon: number): RegionFeature | null {
  return regionAt({ type: "FeatureCollection", features }, lon, lat);
}

/** Fire season of the region from the static calendar (climatology over 2000-2025). */
export function seasonContext(entry: IndexRegion) {
  return {
    mode: entry.mode,
    peak_month: entry.peak_month,
    onset: entry.onset,
    end: entry.end,
    season_length: entry.season_length,
    note: "Climatology of the burning calendar (detections 2000-11 to 2025-12), months 1-12.",
  };
}
