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
import { MAP_RAMP_MAX, MAP_RAMP_MIN, NO_SCALE_GREY, rampColors } from "./charts/ramp.ts";
import { attachAoiDraw } from "./aoi/draw.ts";
import type { Aoi } from "./aoi/geojson.ts";

const RAMP = rampColors(9, MAP_RAMP_MAX, MAP_RAMP_MIN);
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumSignificantDigits: 2 });
const si = (n: number) => compact.format(n).replace("K", "k");

/** Legend overlay: the fill is sqrt(density / max), so max / 4 sits in the middle. */
function legendHtml(harmMax: number, hasRelative: boolean): string {
  return `<div class="map-legend-title"><span class="lt-long">Detections per 1000 km² per year, harmonized</span><span class="lt-short">Detections / 1000 km² / year</span></div>
    <div class="map-legend-ramp" style="background: linear-gradient(to right, ${RAMP.join(", ")})"></div>
    <div class="map-legend-ticks"><span>0</span><span>${si(harmMax / 4)}</span><span>${si(harmMax)}</span></div>
    ${hasRelative ? `<div class="map-legend-rel"><i style="background:${NO_SCALE_GREY}"></i>Not harmonized</div>` : ""}`;
}

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
  /** Draws the custom area (null removes it); fit moves the view to it. */
  showAoi(aoi: Aoi | null, fit?: boolean): void;
}

/** What the map reports about the custom area the user draws or drops. */
export interface AoiHandlers {
  onAoi(aoi: Aoi): void;
  onClear(): void;
  onError(message: string): void;
}

export async function createRegionMap(
  container: HTMLElement,
  onSelect: (id: string) => void,
  forceLocal: boolean,
  aoiHandlers: AoiHandlers,
): Promise<RegionMap> {
  const style = await pickStyle(forceLocal);
  const map = new MlMap({
    container,
    style,
    center: [22, 39],
    zoom: 5,
    attributionControl: { compact: true },
    // Touch screens: one finger scrolls the page, two fingers move the map (no swipe ambiguity).
    cooperativeGestures: matchMedia("(pointer: coarse)").matches,
  });
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  await new Promise<void>((resolve) => map.once("load", () => resolve()));
  // On a phone the compact attribution starts expanded and covers the map; keep it behind its (i) button.
  if (matchMedia("(max-width: 900px)").matches) {
    container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  }

  let selected: string | null = null;
  let marker: Marker | null = null;
  // Region layers go under the basemap labels so city names stay readable (local style has none).
  const beforeId = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  const legend = Object.assign(document.createElement("div"), { className: "map-legend" });
  legend.setAttribute("aria-label", "Map legend");
  container.after(legend);

  map.addSource("regions", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "regions-fill",
    type: "fill",
    source: "regions",
    paint: {
      // Harmonized regions coloured by sqrt(density); relative regions grey (their density is MODIS scale).
      "fill-color": [
        "case",
        ["==", ["get", "mode"], "relative"], NO_SCALE_GREY,
        ["interpolate", ["linear"], ["get", "level_value"], ...RAMP.flatMap((c, i) => [i / (RAMP.length - 1), c])],
      ],
      "fill-opacity": 0.62,
    },
  }, beforeId);
  map.addLayer({
    id: "regions-line",
    type: "line",
    source: "regions",
    paint: { "line-color": "#4a3c36", "line-opacity": 0.55, "line-width": 0.7 },
  }, beforeId);
  map.addLayer({
    id: "regions-hover",
    type: "line",
    source: "regions",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#111", "line-width": 1.4 },
  }, beforeId);
  map.addLayer({
    id: "regions-selected",
    type: "line",
    source: "regions",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#111", "line-width": 2.5 },
  }, beforeId);

  const draw = attachAoiDraw(map, container, aoiHandlers, beforeId);

  map.on("click", "regions-fill", (e) => {
    if (draw.active()) return; // the click adds a vertex of the custom area
    const id = e.features?.[0]?.properties?.id;
    if (typeof id === "string") onSelect(id);
  });
  let hovered = "";
  map.on("mousemove", "regions-fill", (e) => {
    if (draw.active()) return;
    const id = e.features?.[0]?.properties?.id;
    map.getCanvas().style.cursor = "pointer";
    if (typeof id === "string" && id !== hovered) {
      hovered = id;
      map.setFilter("regions-hover", ["==", ["get", "id"], id]);
    }
  });
  map.on("mouseleave", "regions-fill", () => {
    if (!draw.active()) map.getCanvas().style.cursor = "";
    hovered = "";
    map.setFilter("regions-hover", ["==", ["get", "id"], ""]);
  });

  return {
    async setCountry(country, index) {
      const res = await fetch(regionsGeojsonUrl(country));
      const fc = (await res.json()) as Geo;
      const byId = new Map(index.regions.map((r) => [r.id, r]));
      // Density (annual_mean per 1000 km2), so large and small regions compare fairly.
      const density = (r: IndexFile["regions"][number]) =>
        r.annual_mean_of === "harm" ? r.density_per_1000km2 ?? null : null;
      const harmMax = Math.max(
        1,
        ...index.regions.filter((r) => r.level !== "country").map((r) => density(r) ?? 0),
      );
      for (const f of fc.features) {
        const r = byId.get(f.properties.id);
        const props = f.properties as Record<string, unknown>;
        props.mode = r?.mode ?? "relative";
        const d = r ? density(r) : null;
        props.level_value = d != null ? Math.sqrt(d / harmMax) : 0;
      }
      const hasRelative = index.regions.some((r) => r.level !== "country" && r.mode === "relative");
      legend.innerHTML = legendHtml(harmMax, hasRelative);
      (map.getSource("regions") as unknown as { setData(d: unknown): void }).setData(fc);
      // On desktop the legend sits over the bottom-left corner; keep the regions clear of it.
      // On a phone the legend is a strip under the map instead.
      const phone = matchMedia("(max-width: 900px)").matches;
      const pad = phone ? 12 : 24;
      map.fitBounds(bbox(fc), { padding: { top: pad, right: pad, left: pad, bottom: phone ? pad : legend.offsetHeight + pad }, duration: 0 });
      return fc;
    },
    setSelected(id) {
      if (id === selected) return;
      selected = id;
      map.setFilter("regions-selected", ["==", ["get", "id"], selected ?? ""]);
    },
    showAoi(aoi, fit = false) {
      draw.show(aoi, fit);
      // Fade the region colours under a custom area so its outline reads as the subject.
      map.setPaintProperty("regions-fill", "fill-opacity", aoi ? 0.28 : 0.62);
    },
    showPoint(lonLat) {
      // Move the existing marker; building a new one each Find costs a DOM rebuild.
      if (!lonLat) {
        marker?.remove();
        marker = null;
      } else if (marker) marker.setLngLat(lonLat);
      else marker = new Marker({ color: "#1d1b19" }).setLngLat(lonLat).addTo(map);
    },
  };
}
