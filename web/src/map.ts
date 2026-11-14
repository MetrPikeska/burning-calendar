// Region map: OpenFreeMap positron basemap, local Natural Earth fallback when offline
// or with ?basemap=local. Regions from regions.geojson joined with index.json.
import { Map as MlMap, Marker, NavigationControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 resolves its worker next to import.meta.url, which a bundle breaks; hand Vite the file.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(workerUrl);
import type { CountryCode, IndexFile } from "./lib/contract.ts";
import { regionsGeojsonUrl } from "./lib/data.ts";
import type { RegionCollection } from "./lib/geo.ts";

const ONLINE_STYLE = "https://tiles.openfreemap.org/styles/positron";
const STYLE_TIMEOUT_MS = 3000;

const LOCAL_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    land: { type: "geojson", data: "/data/base/land.geojson" },
  },
  layers: [
    { id: "sea", type: "background", paint: { "background-color": "#dce6ec" } },
    { id: "land", type: "fill", source: "land", paint: { "fill-color": "#f3f1ec" } },
    { id: "land-line", type: "line", source: "land", paint: { "line-color": "#b8b4ab", "line-width": 0.6 } },
  ],
};

async function pickStyle(forceLocal: boolean): Promise<string | StyleSpecification> {
  if (forceLocal || !navigator.onLine) return LOCAL_STYLE;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STYLE_TIMEOUT_MS);
  try {
    const res = await fetch(ONLINE_STYLE, { signal: ctrl.signal });
    return res.ok ? ONLINE_STYLE : LOCAL_STYLE;
  } catch {
    return LOCAL_STYLE;
  } finally {
    clearTimeout(timer);
  }
}

type Geo = RegionCollection;

function bbox(fc: Geo): [number, number, number, number] {
  let [w, s, e, n] = [180, 90, -180, -90];
  const visit = (c: unknown): void => {
    if (typeof (c as number[])[0] === "number") {
      const [x, y] = c as number[];
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
    } else (c as unknown[]).forEach(visit);
  };
  fc.features.forEach((f) => visit(f.geometry.coordinates));
  return [w, s, e, n];
}

export interface RegionMap {
  /** Loads the country's regions.geojson, joins index metrics, fits the view; returns the geometry. */
  setCountry(country: CountryCode, index: IndexFile): Promise<RegionCollection>;
  setSelected(id: string | null): void;
  /** Marker for a user-entered point; null removes it. */
  showPoint(lonLat: [number, number] | null): void;
}

export async function createRegionMap(
  container: HTMLElement,
  onSelect: (id: string) => void,
  forceLocal: boolean,
): Promise<RegionMap> {
  const style = await pickStyle(forceLocal);
  const map = new MlMap({ container, style, center: [22, 39], zoom: 5, attributionControl: { compact: true } });
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  await new Promise<void>((resolve) => map.once("load", () => resolve()));

  let selected: string | null = null;
  let marker: Marker | null = null;

  map.addSource("regions", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "regions-fill",
    type: "fill",
    source: "regions",
    paint: {
      // Harmonized regions coloured by sqrt(annual_mean); relative regions grey (their mean is MODIS scale).
      "fill-color": [
        "case",
        ["==", ["get", "mode"], "relative"], "#c9c9c9",
        ["interpolate", ["linear"], ["get", "level_value"], 0, "#fff1d6", 1, "#b2182b"],
      ],
      "fill-opacity": 0.75,
    },
  });
  map.addLayer({
    id: "regions-line",
    type: "line",
    source: "regions",
    paint: { "line-color": "#5a4a42", "line-width": 0.7 },
  });
  map.addLayer({
    id: "regions-selected",
    type: "line",
    source: "regions",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#111", "line-width": 2.5 },
  });

  map.on("click", "regions-fill", (e) => {
    const id = e.features?.[0]?.properties?.id;
    if (typeof id === "string") onSelect(id);
  });
  map.on("mouseenter", "regions-fill", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "regions-fill", () => (map.getCanvas().style.cursor = ""));

  return {
    async setCountry(country, index) {
      const res = await fetch(regionsGeojsonUrl(country));
      const fc = (await res.json()) as Geo;
      const byId = new Map(index.regions.map((r) => [r.id, r]));
      const harmMax = Math.max(
        1,
        ...index.regions.filter((r) => r.level !== "country" && r.annual_mean_of === "harm").map((r) => r.annual_mean),
      );
      for (const f of fc.features) {
        const r = byId.get(f.properties.id);
        const props = f.properties as Record<string, unknown>;
        props.mode = r?.mode ?? "relative";
        props.level_value = r && r.annual_mean_of === "harm" ? Math.sqrt(r.annual_mean / harmMax) : 0;
      }
      (map.getSource("regions") as unknown as { setData(d: unknown): void }).setData(fc);
      map.fitBounds(bbox(fc), { padding: 24, duration: 0 });
      return fc;
    },
    setSelected(id) {
      selected = id;
      map.setFilter("regions-selected", ["==", ["get", "id"], selected ?? ""]);
    },
    showPoint(lonLat) {
      marker?.remove();
      marker = lonLat ? new Marker({ color: "#0b62a4" }).setLngLat(lonLat).addTo(map) : null;
    },
  };
}
