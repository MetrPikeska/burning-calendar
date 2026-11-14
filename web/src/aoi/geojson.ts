// AOI geometry: what the user drew or dropped, as polygons plus points and lines with a radius.
// Parsing, limits, containment, bbox, area and the GeoJSON for the map and the download. DOM-free.
import { distanceToLineKm, distanceToPointKm, inPolygon, type RegionCollection } from "../lib/geo.ts";

type Ring = number[][];

export interface Aoi {
  polygons: Ring[][];
  points: number[][];
  lines: number[][][];
  /** Radius around points and lines, km. */
  radius_km: number;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_VERTICES = 20_000;
export const DEFAULT_RADIUS_KM = 5;

export class AoiError extends Error {}

export const emptyAoi = (radius_km = DEFAULT_RADIUS_KM): Aoi => ({ polygons: [], points: [], lines: [], radius_km });
export const isEmpty = (a: Aoi) => !a.polygons.length && !a.points.length && !a.lines.length;

const isPos = (c: unknown): c is number[] =>
  Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number" &&
  Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;

function ring(c: unknown): Ring {
  if (!Array.isArray(c) || c.length < 4 || !c.every(isPos)) throw new AoiError("A polygon ring needs at least 4 lon/lat positions in degrees.");
  return c.map((p) => [p[0], p[1]]);
}

/** Adds one GeoJSON geometry to the AOI; unsupported types raise an AoiError. */
function addGeometry(aoi: Aoi, g: unknown): void {
  const geom = g as { type?: string; coordinates?: unknown; geometries?: unknown[] } | null;
  if (!geom || typeof geom.type !== "string") throw new AoiError("A feature has no geometry.");
  const c = geom.coordinates as unknown[];
  switch (geom.type) {
    case "Polygon": aoi.polygons.push((c as unknown[]).map(ring)); break;
    case "MultiPolygon": for (const p of c) aoi.polygons.push((p as unknown[]).map(ring)); break;
    case "Point": if (!isPos(c)) throw new AoiError("A point needs lon/lat in degrees."); aoi.points.push([c[0], c[1]]); break;
    case "MultiPoint": for (const p of c) { if (!isPos(p)) throw new AoiError("A point needs lon/lat in degrees."); aoi.points.push([p[0], p[1]]); } break;
    case "LineString": if (!Array.isArray(c) || c.length < 2 || !c.every(isPos)) throw new AoiError("A line needs at least 2 lon/lat positions."); aoi.lines.push(c.map((p) => [p[0], p[1]])); break;
    case "MultiLineString": for (const l of c) addGeometry(aoi, { type: "LineString", coordinates: l }); break;
    case "GeometryCollection": for (const x of geom.geometries ?? []) addGeometry(aoi, x); break;
    default: throw new AoiError(`Geometry type ${geom.type} is not supported.`);
  }
}

export const vertexCount = (a: Aoi) =>
  a.points.length + a.lines.reduce((s, l) => s + l.length, 0) + a.polygons.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);

/** Parses a GeoJSON text (Geometry, Feature or FeatureCollection) in WGS 84 lon/lat. */
export function parseGeoJson(text: string, radius_km = DEFAULT_RADIUS_KM): Aoi {
  if (text.length > MAX_FILE_BYTES) throw new AoiError("The file is larger than 5 MB.");
  let obj: { type?: string; features?: unknown[]; geometry?: unknown; crs?: { properties?: { name?: string } } };
  try {
    obj = JSON.parse(text);
  } catch {
    throw new AoiError("The file is not valid JSON.");
  }
  const crs = obj?.crs?.properties?.name;
  if (crs && !/CRS84|EPSG::?4326/i.test(crs)) throw new AoiError(`Coordinates must be WGS 84 lon/lat; the file declares ${crs}.`);
  const aoi = emptyAoi(radius_km);
  if (obj?.type === "FeatureCollection") (obj.features ?? []).forEach((f) => addGeometry(aoi, (f as { geometry?: unknown }).geometry));
  else if (obj?.type === "Feature") addGeometry(aoi, obj.geometry);
  else addGeometry(aoi, obj);
  if (isEmpty(aoi)) throw new AoiError("The file holds no polygon, point or line.");
  if (vertexCount(aoi) > MAX_VERTICES) throw new AoiError(`The area has more than ${MAX_VERTICES.toLocaleString("en")} vertices; simplify it first.`);
  return aoi;
}

/** True when the point lies in a polygon or within radius_km of a point or line. */
export function contains(a: Aoi, lon: number, lat: number): boolean {
  return a.polygons.some((p) => inPolygon(lon, lat, p)) ||
    a.points.some((p) => distanceToPointKm(lon, lat, p) <= a.radius_km) ||
    a.lines.some((l) => distanceToLineKm(lon, lat, l) <= a.radius_km);
}

export type Bbox = [number, number, number, number];

/** [west, south, east, north], points and lines padded by the radius. */
export function aoiBbox(a: Aoi): Bbox {
  let [w, s, e, n] = [180, 90, -180, -90];
  const add = (p: number[], pad: number) => {
    const dLat = pad / 110.57;
    const dLon = pad / Math.max(1e-6, 111.32 * Math.cos((p[1] * Math.PI) / 180));
    w = Math.min(w, p[0] - dLon); e = Math.max(e, p[0] + dLon); s = Math.min(s, p[1] - dLat); n = Math.max(n, p[1] + dLat);
  };
  a.polygons.forEach((p) => p[0].forEach((q) => add(q, 0)));
  a.points.forEach((q) => add(q, a.radius_km));
  a.lines.forEach((l) => l.forEach((q) => add(q, a.radius_km)));
  return [w, s, e, n];
}

export const bboxesMeet = (a: Bbox, b: Bbox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/** Bbox of every region feature. */
export function regionBboxes(fc: RegionCollection): Map<string, Bbox> {
  const out = new Map<string, Bbox>();
  for (const f of fc.features) {
    let [w, s, e, n] = [180, 90, -180, -90];
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) for (const [x, y] of p[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
    out.set(f.properties.id, [w, s, e, n]);
  }
  return out;
}

/** Shoelace area of a ring in km2, projected at its mean latitude. */
function ringAreaKm2(r: Ring): number {
  const lat0 = r.reduce((a, p) => a + p[1], 0) / r.length;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] * kx) * (r[i][1] * 110.57) - (r[i][0] * kx) * (r[j][1] * 110.57);
  return Math.abs(a / 2);
}

const lineLengthKm = (l: number[][]) => l.slice(1).reduce((s, p, i) => s + distanceToPointKm(p[0], p[1], l[i]), 0);

/** Approximate area in km2 (overlaps between parts are counted twice). */
export function areaKm2(a: Aoi): number {
  const poly = a.polygons.reduce((s, p) => s + ringAreaKm2(p[0]) - p.slice(1).reduce((t, h) => t + ringAreaKm2(h), 0), 0);
  const disc = Math.PI * a.radius_km ** 2;
  return poly + a.points.length * disc + a.lines.reduce((s, l) => s + 2 * a.radius_km * lineLengthKm(l) + disc, 0);
}

/** 64-gon around a point, for the map. */
export function circle(p: number[], radiusKm: number, n = 64): Ring {
  const kx = 111.32 * Math.cos((p[1] * Math.PI) / 180);
  const r = Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return [p[0] + (radiusKm * Math.cos(t)) / kx, p[1] + (radiusKm * Math.sin(t)) / 110.57];
  });
  return [...r, r[0]];
}

/** The AOI as GeoJSON: polygons, the point circles, lines (with radius_km), for the map and the download. */
export function aoiToGeoJson(a: Aoi): { type: "FeatureCollection"; features: object[] } {
  const f = (geometry: object, role: string) => ({ type: "Feature", properties: { role, radius_km: role === "polygon" ? null : a.radius_km }, geometry });
  return {
    type: "FeatureCollection",
    features: [
      ...a.polygons.map((p) => f({ type: "Polygon", coordinates: p }, "polygon")),
      ...a.points.map((p) => f({ type: "Point", coordinates: p }, "point")),
      ...a.points.map((p) => f({ type: "Polygon", coordinates: [circle(p, a.radius_km)] }, "point-buffer")),
      ...a.lines.map((l) => f({ type: "LineString", coordinates: l }, "line")),
    ],
  };
}
