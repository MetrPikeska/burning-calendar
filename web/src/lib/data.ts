// Fetch helpers for the static data. DOM-free apart from fetch, which Node 22 has too.
import type { CountryCode, IndexFile, RegionFile } from "./contract.ts";

export const DATA_VERSION = "v1";

export function dataUrl(country: CountryCode, path: string, base = "/"): string {
  return `${base}data/${DATA_VERSION}/${country}/${path}`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function loadIndex(country: CountryCode): Promise<IndexFile> {
  return getJson<IndexFile>(dataUrl(country, "index.json"));
}

export function loadRegion(country: CountryCode, id: string): Promise<RegionFile> {
  return getJson<RegionFile>(dataUrl(country, `regions/${encodeURIComponent(id)}.json`));
}

export function regionsGeojsonUrl(country: CountryCode): string {
  return dataUrl(country, "regions.geojson");
}
