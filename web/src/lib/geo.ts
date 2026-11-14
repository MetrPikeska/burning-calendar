// Point-in-polygon over regions.geojson and lat/lon parsing. DOM-free (usable by api/mcp.ts).

type Ring = number[][];

export interface RegionFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
  properties: { id: string; name: string };
}

export interface RegionCollection {
  type: "FeatureCollection";
  features: RegionFeature[];
}

export function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Outer ring minus holes. */
export function inPolygon(lon: number, lat: number, rings: Ring[]): boolean {
  if (!rings.length || !inRing(lon, lat, rings[0])) return false;
  return !rings.slice(1).some((hole) => inRing(lon, lat, hole));
}

/** First region containing the point, or null. */
export function regionAt(fc: RegionCollection, lon: number, lat: number): RegionFeature | null {
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    if (polys.some((rings) => inPolygon(lon, lat, rings))) return f;
  }
  return null;
}

const KM_PER_DEG_LAT = 110.57;
const kmPerDegLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Distance in km between two lon/lat points (local equirectangular; fine for tens of km). */
export function distanceToPointKm(lon: number, lat: number, p: number[]): number {
  return Math.hypot((lon - p[0]) * kmPerDegLon((lat + p[1]) / 2), (lat - p[1]) * KM_PER_DEG_LAT);
}

/** Shortest distance in km from a point to a polyline (same projection as distanceToPointKm). */
export function distanceToLineKm(lon: number, lat: number, line: number[][]): number {
  if (line.length === 1) return distanceToPointKm(lon, lat, line[0]);
  const kx = kmPerDegLon(lat);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const ax = (line[i - 1][0] - lon) * kx, ay = (line[i - 1][1] - lat) * KM_PER_DEG_LAT;
    const bx = (line[i][0] - lon) * kx, by = (line[i][1] - lat) * KM_PER_DEG_LAT;
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/**
 * Parse "lat, lon" in decimal degrees ("40.64, 22.94", "40.64 22.94", "-34.6;-58.4").
 * Returns null when it is not two numbers in range.
 */
export function parseLatLon(text: string): { lat: number; lon: number } | null {
  const parts = text.trim().split(/[\s,;]+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const [lat, lon] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
