// Individual detections for the AOI: data/v1/gr/detections/{EL..}.csv, written by pipeline/hotspots.py
// after the same type and static-source filters as the monthly counts. Only the NUTS2 files whose
// region bbox meets the AOI bbox are fetched; GR.csv is not (it repeats the regional files plus 240
// detections outside every region).
import { dataUrl } from "../lib/data.ts";
import type { Detection } from "./compute.ts";

export const DETECTIONS_HEADER = "region_id,sensor,satellite,acq_date,acq_time,daynight,latitude,longitude,frp,confidence,version,provisional";

/** Parses a detections CSV; rows that do not fit the expected columns are skipped. */
export function parseDetectionsCsv(text: string): Detection[] {
  const lines = text.split("\n");
  if (!lines[0]?.startsWith("region_id,sensor,satellite,acq_date")) throw new Error("not a detections CSV");
  const out: Detection[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.split(",");
    const lat = Number(c[6]);
    const lon = Number(c[7]);
    const sensor = c[1];
    const dn = c[5];
    if ((sensor !== "modis" && sensor !== "viirs") || (dn !== "D" && dn !== "N") || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ region_id: c[0], sensor, satellite: c[2], date: c[3], dn, lat, lon, line });
  }
  return out;
}

const cache = new Map<string, Promise<Detection[]>>();

/** Detections of one Greek NUTS2 region, fetched once per page load. */
export function loadRegionDetections(id: string): Promise<Detection[]> {
  if (!cache.has(id)) {
    const p = fetch(dataUrl("gr", `detections/${encodeURIComponent(id)}.csv`))
      .then((r) => {
        if (!r.ok) throw new Error(`detections ${id}: HTTP ${r.status}`);
        return r.text();
      })
      .then(parseDetectionsCsv);
    p.catch(() => cache.delete(id)); // a failed fetch is retried next time
    cache.set(id, p);
  }
  return cache.get(id)!;
}
