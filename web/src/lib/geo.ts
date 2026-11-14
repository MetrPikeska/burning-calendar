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

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Outer ring minus holes. */
function inPolygon(lon: number, lat: number, rings: Ring[]): boolean {
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
