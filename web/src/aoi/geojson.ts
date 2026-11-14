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
/** Limits of the radius picker in the draw bar. */
export const RADIUS_MIN_KM = 0.5;
export const RADIUS_MAX_KM = 50;

export class AoiError extends Error {}

export const emptyAoi = (radius_km = DEFAULT_RADIUS_KM): Aoi => ({ polygons: [], points: [], lines: [], radius_km });
export const isEmpty = (a: Aoi) => !a.polygons.length && !a.points.length && !a.lines.length;

const isPos = (c: unknown): c is number[] =>
  Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number" &&
  Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;

/** Rings longer than this skip the O(n2) crossing check (a 20 000-vertex file stays responsive). */
export const MAX_CROSSING_CHECK = 5000;

const orient = (a: number[], b: number[], c: number[]) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));

/** r lies within the bbox of segment pq (used when r is collinear with pq). */
const onSegment = (p: number[], q: number[], r: number[]) =>
  Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0]) && Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);

/** True when the ring turns straight back at vertex b: a, b, c collinear and a, c on the same side of b. */
const foldsBack = (a: number[], b: number[], c: number[]) =>
  orient(a, b, c) === 0 && (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]) > 0;

/** True when two non-adjacent edges of a closed ring cross, touch or overlap (a bowtie), or when an edge
 *  folds straight back on its neighbour (a spike), audit BC3-008. */
export function ringSelfIntersects(r: Ring): boolean {
  const n = r.length - 1; // edges of a closed ring
  if (n > MAX_CROSSING_CHECK) return false;
  for (let i = 0; i < n; i++) if (foldsBack(r[(i + n - 1) % n], r[i], r[i + 1])) return true;
  for (let i = 0; i < n; i++) {
    const [a, b] = [r[i], r[i + 1]];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // first and last edge share the closing vertex
      const [c, d] = [r[j], r[j + 1]];
      const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
      if (o1 * o2 < 0 && o3 * o4 < 0) return true;
      if ((o1 === 0 && onSegment(a, b, c)) || (o2 === 0 && onSegment(a, b, d)) ||
          (o3 === 0 && onSegment(c, d, a)) || (o4 === 0 && onSegment(c, d, b))) return true;
    }
  }
  return false;
}

function ring(c: unknown): Ring {
  if (!Array.isArray(c) || c.length < 4 || !c.every(isPos)) throw new AoiError("A polygon ring needs at least 4 lon/lat positions in degrees.");
  const r = c.map((p) => [p[0], p[1]]);
  const [f, l] = [r[0], r[r.length - 1]];
  if (Math.abs(f[0] - l[0]) > 1e-9 || Math.abs(f[1] - l[1]) > 1e-9) {
    throw new AoiError("A polygon ring is not closed: its first and last positions differ.");
  }
  if (ringSelfIntersects(r)) throw new AoiError("A polygon's edges cross each other (a bowtie); fix the geometry first.");
  return r;
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
  type Feat = { geometry?: unknown; properties?: { role?: unknown; radius_km?: unknown } | null };
  const feats: Feat[] = obj?.type === "FeatureCollection" ? ((obj.features ?? []) as Feat[]) : obj?.type === "Feature" ? [obj as Feat] : [];
  // Our own export (aoiToGeoJson) round-trips: its point circles are map decoration next to the point, and the
  // radius it was drawn with travels in radius_km (audit R2-002: re-import doubled the area and took the picker radius).
  const ours = feats.filter((f) => f.properties?.role === "point" || f.properties?.role === "line")
    .map((f) => f.properties?.radius_km).find((r): r is number => typeof r === "number" && r >= RADIUS_MIN_KM && r <= RADIUS_MAX_KM);
  const aoi = emptyAoi(ours ?? radius_km);
  if (obj?.type === "FeatureCollection" || obj?.type === "Feature") {
    for (const f of feats) if (f.properties?.role !== "point-buffer") addGeometry(aoi, f.geometry);
  }
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

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Area of a closed lon/lat ring on the sphere, km2 (sum over edges; exact for a spherical polygon). */
export function sphericalRingAreaKm2(r: Ring): number {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += rad(r[i + 1][0] - r[i][0]) * (2 + Math.sin(rad(r[i][1])) + Math.sin(rad(r[i + 1][1])));
  return Math.abs((a * R_KM * R_KM) / 2);
}

const polygonAreaKm2 = (p: Ring[]) => sphericalRingAreaKm2(p[0]) - p.slice(1).reduce((t, h) => t + sphericalRingAreaKm2(h), 0);

/** Cells x vertices kept under this, so the grid estimate stays well under a second on the main thread. */
export const GRID_BUDGET = 2e7;
const GRID_MAX_CELLS = 50_000;
/** Floor that still respects the budget at MAX_VERTICES. */
const GRID_MIN_CELLS = GRID_BUDGET / MAX_VERTICES;

/** Grid cells for an AOI with this many vertices. */
export const gridCells = (vertices: number) =>
  Math.max(GRID_MIN_CELLS, Math.min(GRID_MAX_CELLS, Math.floor(GRID_BUDGET / Math.max(1, vertices))));

/** Area of the union, km2, by sampling contains() on a lon/lat grid. Each cell carries its exact area on the
 *  same sphere as sphericalRingAreaKm2, so a gridded AOI and an exact one agree. */
function gridAreaKm2(a: Aoi): number {
  const [w, s, e, n] = aoiBbox(a);
  const cells = gridCells(vertexCount(a));
  const wKm = (e - w) * 111.32 * Math.cos(rad((s + n) / 2));
  const hKm = (n - s) * 110.57;
  const cols = Math.max(1, Math.round(Math.sqrt((cells * wKm) / Math.max(hKm, 1e-9))));
  const rows = Math.max(1, Math.round(cells / cols));
  const dLon = (e - w) / cols, dLat = (n - s) / rows;
  let area = 0;
  for (let j = 0; j < rows; j++) {
    const lat = s + (j + 0.5) * dLat;
    const cellKm2 = R_KM * R_KM * rad(dLon) * (Math.sin(rad(s + (j + 1) * dLat)) - Math.sin(rad(s + j * dLat)));
    for (let i = 0; i < cols; i++) if (contains(a, w + (i + 0.5) * dLon, lat)) area += cellKm2;
  }
  return area;
}

/** Area of the AOI as a union of its parts, km2 (audit BC3-001: overlaps count once). Polygons that cannot
 *  overlap (disjoint bboxes) use the exact spherical area; anything with circles, lines or overlaps is gridded. */
export function areaKm2(a: Aoi): number {
  if (!a.points.length && !a.lines.length) {
    const boxes = a.polygons.map((p) => aoiBbox({ ...emptyAoi(0), polygons: [p] }));
    const disjoint = boxes.every((b, i) => boxes.every((c, j) => j <= i || !bboxesMeet(b, c)));
    if (disjoint) return a.polygons.reduce((t, p) => t + polygonAreaKm2(p), 0);
  }
  if (!a.polygons.length && !a.lines.length && a.points.length === 1) return Math.PI * a.radius_km ** 2;
  return gridAreaKm2(a);
}

/** Bbox grown by km on every side. */
export function padBbox(b: Bbox, km: number): Bbox {
  const dLat = km / 110.57;
  const dLon = km / Math.max(1e-6, 111.32 * Math.cos(rad(Math.max(Math.abs(b[1]), Math.abs(b[3])))));
  return [b[0] - dLon, b[1] - dLat, b[2] + dLon, b[3] + dLat];
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

/** The AOI as GeoJSON: polygons, the point circles, lines (with radius_km), for the map and the download.
 *  Every feature carries the note in its properties, where GIS tools keep it. */
export const AOI_NOTE = "Burning Calendar custom area. Values before Feb 2012 are an exploratory estimate with the factors of each detection's NUTS2 region, not validated for this area.";

export function aoiToGeoJson(a: Aoi): { type: "FeatureCollection"; features: object[] } {
  const f = (geometry: object, role: string) =>
    ({ type: "Feature", properties: { role, radius_km: role === "polygon" ? null : a.radius_km, note: AOI_NOTE }, geometry });
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
