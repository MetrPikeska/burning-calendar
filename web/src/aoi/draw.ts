// AOI input on the map without a draw library: a control with Polygon, Point, Line, Upload GeoJSON,
// a radius for points and lines, Done and Clear, plus a drop zone for GeoJSON files.
// Polygon: click adds a vertex; double-click, Enter or Done closes it; Esc cancels.
import type { FilterSpecification, GeoJSONSource, IControl, Map as MlMap, MapMouseEvent } from "maplibre-gl";
import { type Aoi, AoiError, aoiBbox, aoiToGeoJson, DEFAULT_RADIUS_KM, emptyAoi, isEmpty, parseGeoJson } from "./geojson.ts";

type Mode = "polygon" | "point" | "line";
const AOI_COLOR = "#1565b5";
const EMPTY = { type: "FeatureCollection" as const, features: [] };

export interface AoiDraw {
  /** True while a shape is being drawn: map clicks then add vertices instead of picking a region. */
  active(): boolean;
  /** Shows the AOI on the map (null removes it) and fits the view when asked. */
  show(aoi: Aoi | null, fit?: boolean): void;
  /** Leaves drawing mode without a result. */
  cancel(): void;
}

interface Callbacks {
  onAoi(aoi: Aoi): void;
  onClear(): void;
  onError(message: string): void;
}

/** Metres per pixel at zoom 0 for MapLibre's 512 px tiles, at latitude 0. */
const M_PER_PX_Z0 = 78271.517;

export function attachAoiDraw(map: MlMap, container: HTMLElement, cb: Callbacks, beforeId?: string): AoiDraw {
  let mode: Mode | null = null;
  let verts: number[][] = [];
  let hover: number[] | null = null;
  let current: Aoi | null = null;
  /** Time of the last map click used for drawing; the region click handler must ignore that click. */
  let consumedAt = -Infinity;

  // ---------- layers ----------
  map.addSource("aoi", { type: "geojson", data: EMPTY });
  map.addSource("aoi-sketch", { type: "geojson", data: EMPTY });
  const polyFilter = ["in", ["get", "role"], ["literal", ["polygon", "point-buffer"]]] as unknown as FilterSpecification;
  map.addLayer({ id: "aoi-fill", type: "fill", source: "aoi", filter: polyFilter, paint: { "fill-color": AOI_COLOR, "fill-opacity": 0.14 } }, beforeId);
  map.addLayer({ id: "aoi-outline", type: "line", source: "aoi", filter: polyFilter, paint: { "line-color": AOI_COLOR, "line-width": 2.2 } }, beforeId);
  map.addLayer({ id: "aoi-line-buffer", type: "line", source: "aoi", filter: ["==", ["get", "role"], "line"],
    layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": AOI_COLOR, "line-opacity": 0.14, "line-width": 1 } }, beforeId);
  map.addLayer({ id: "aoi-line", type: "line", source: "aoi", filter: ["==", ["get", "role"], "line"], paint: { "line-color": AOI_COLOR, "line-width": 2.2 } }, beforeId);
  map.addLayer({ id: "aoi-point", type: "circle", source: "aoi", filter: ["==", ["get", "role"], "point"],
    paint: { "circle-radius": 4, "circle-color": AOI_COLOR, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } }, beforeId);
  map.addLayer({ id: "aoi-sketch-line", type: "line", source: "aoi-sketch", filter: ["==", ["geometry-type"], "LineString"],
    paint: { "line-color": AOI_COLOR, "line-width": 2, "line-dasharray": [2, 1.5] } });
  map.addLayer({ id: "aoi-sketch-vertex", type: "circle", source: "aoi-sketch", filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 4, "circle-color": "#fff", "circle-stroke-color": AOI_COLOR, "circle-stroke-width": 2 } });

  const setData = (id: string, data: unknown) => (map.getSource(id) as GeoJSONSource).setData(data as never);

  /** Line buffer drawn as a wide line: the width in pixels that covers 2 x radius at the line's latitude. */
  function bufferWidth(aoi: Aoi): void {
    const lat = aoi.lines[0]?.[0]?.[1] ?? 0;
    const z0 = (2 * aoi.radius_km * 1000) / (M_PER_PX_Z0 * Math.cos((lat * Math.PI) / 180));
    map.setPaintProperty("aoi-line-buffer", "line-width", ["interpolate", ["exponential", 2], ["zoom"], 0, z0, 22, z0 * 2 ** 22]);
  }

  function sketch(): void {
    const pts = hover && mode !== "point" ? [...verts, hover] : verts;
    const ring = mode === "polygon" && pts.length >= 3 ? [...pts, pts[0]] : pts;
    setData("aoi-sketch", {
      type: "FeatureCollection",
      features: [
        ...(ring.length >= 2 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } }] : []),
        ...verts.map((v) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: v } })),
      ],
    });
  }

  // ---------- control ----------
  const el = document.createElement("div");
  el.className = "maplibregl-ctrl aoi-ctrl";
  el.innerHTML = `
    <button type="button" class="aoi-title" aria-expanded="true">Your area</button>
    <div class="aoi-tools" role="group" aria-label="Draw an area of interest">
      <button type="button" data-mode="polygon" aria-pressed="false" title="Draw a polygon">Polygon</button>
      <button type="button" data-mode="point" aria-pressed="false" title="Area around a point">Point</button>
      <button type="button" data-mode="line" aria-pressed="false" title="Area along a line">Line</button>
    </div>
    <label class="aoi-radius">Radius <input type="number" min="0.5" max="50" step="0.5" value="${DEFAULT_RADIUS_KM}" inputmode="decimal" aria-label="Radius around points and lines, km" /> km</label>
    <div class="aoi-actions">
      <button type="button" class="aoi-upload" title="GeoJSON in WGS 84 lon/lat (or drop the file on the map)">Upload GeoJSON</button>
      <button type="button" class="aoi-done" hidden>Done</button>
      <button type="button" class="aoi-clear" hidden>Clear</button>
    </div>
    <p class="aoi-hint" role="status"></p>
    <input type="file" accept=".geojson,.json,application/geo+json,application/json" hidden />`;
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const hint = q<HTMLParagraphElement>(".aoi-hint");
  const radiusInput = q<HTMLInputElement>(".aoi-radius input");
  const fileInput = q<HTMLInputElement>("input[type=file]");
  const radius = () => {
    const r = Number(radiusInput.value);
    return Number.isFinite(r) && r >= 0.5 && r <= 50 ? r : DEFAULT_RADIUS_KM;
  };
  const HINT: Record<Mode, string> = {
    polygon: "Click to add corners. Double-click, Enter or Done closes the polygon. Esc cancels.",
    point: "Click the map to place the point.",
    line: "Click to add points. Double-click, Enter or Done ends the line. Esc cancels.",
  };

  const narrow = () => matchMedia("(max-width: 900px)").matches;
  const toggle = q<HTMLButtonElement>(".aoi-title");
  /** Collapsed: only the title, the hint and Done / Clear; on a phone the full control would cover the map. */
  function setCollapsed(c: boolean): void {
    el.classList.toggle("collapsed", c);
    toggle.setAttribute("aria-expanded", String(!c));
  }
  toggle.addEventListener("click", () => setCollapsed(!el.classList.contains("collapsed")));
  setCollapsed(narrow());

  function refresh(): void {
    el.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    q(".aoi-done").hidden = !(mode === "polygon" || mode === "line");
    q(".aoi-clear").hidden = !current && !mode;
    hint.textContent = mode ? HINT[mode] : current ? "" : "Draw, or drop a GeoJSON file on the map.";
    map.getCanvas().style.cursor = mode ? "crosshair" : "";
    el.classList.toggle("drawing", mode !== null);
  }

  function start(m: Mode): void {
    mode = mode === m ? null : m;
    verts = [];
    hover = null;
    sketch();
    if (mode) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    if (mode && narrow()) setCollapsed(true);
    refresh();
  }

  function stop(): void {
    mode = null;
    verts = [];
    hover = null;
    sketch();
    // Re-enable after the double-click that closed the shape has passed.
    setTimeout(() => map.doubleClickZoom.enable(), 300);
    refresh();
  }

  /** Drops repeated vertices (a double-click adds the same point twice). */
  const dedupe = (vs: number[][]) => vs.filter((v, i) => i === 0 || Math.hypot(v[0] - vs[i - 1][0], v[1] - vs[i - 1][1]) > 1e-7);

  function finish(): void {
    const vs = dedupe(verts);
    const aoi = emptyAoi(radius());
    if (mode === "polygon") {
      if (vs.length < 3) { hint.textContent = "A polygon needs at least 3 corners."; return; }
      aoi.polygons.push([[...vs, vs[0]]]);
    } else if (mode === "line") {
      if (vs.length < 2) { hint.textContent = "A line needs at least 2 points."; return; }
      aoi.lines.push(vs);
    } else if (mode === "point" && vs.length) {
      aoi.points.push(vs[0]);
    } else return;
    stop();
    cb.onAoi(aoi);
  }

  el.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => b.addEventListener("click", () => start(b.dataset.mode as Mode)));
  q(".aoi-done").addEventListener("click", finish);
  q(".aoi-clear").addEventListener("click", () => {
    stop();
    cb.onClear();
  });
  q(".aoi-upload").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) void readFile(f);
    fileInput.value = "";
  });
  radiusInput.addEventListener("change", () => {
    // A new radius redraws an area built from points or lines.
    if (current && (current.points.length || current.lines.length)) cb.onAoi({ ...current, radius_km: radius() });
  });

  const control: IControl = { onAdd: () => el, onRemove: () => el.remove() };
  map.addControl(control, "top-right");

  // ---------- map events ----------
  map.on("click", (e: MapMouseEvent) => {
    if (!mode) return;
    consumedAt = performance.now();
    verts.push([e.lngLat.lng, e.lngLat.lat]);
    if (mode === "point") finish();
    else sketch();
  });
  map.on("dblclick", (e) => {
    if (!mode) return;
    e.preventDefault();
    finish();
  });
  map.on("mousemove", (e) => {
    if (!mode || !verts.length) return;
    hover = [e.lngLat.lng, e.lngLat.lat];
    sketch();
  });
  window.addEventListener("keydown", (e) => {
    if (!mode) return;
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && t !== radiusInput) return;
    if (e.key === "Escape") { e.preventDefault(); stop(); }
    if (e.key === "Enter") { e.preventDefault(); finish(); }
  });

  // ---------- file drop ----------
  async function readFile(f: File): Promise<void> {
    try {
      if (f.size > 5 * 1024 * 1024) throw new AoiError("The file is larger than 5 MB.");
      const aoi = parseGeoJson(await f.text(), radius());
      stop();
      cb.onAoi(aoi);
    } catch (err) {
      const msg = err instanceof AoiError ? err.message : "Could not read the file.";
      hint.textContent = msg;
      cb.onError(msg);
    }
  }
  const overlay = Object.assign(document.createElement("div"), { className: "aoi-drop", textContent: "Drop a GeoJSON file to use it as your area" });
  overlay.hidden = true;
  container.append(overlay);
  let depth = 0;
  const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes("Files");
  container.addEventListener("dragenter", (e) => { if (hasFiles(e)) { depth++; overlay.hidden = false; } });
  container.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) overlay.hidden = true; });
  container.addEventListener("dragover", (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer!.dropEffect = "copy"; } });
  container.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    const f = e.dataTransfer?.files?.[0];
    if (f) void readFile(f);
  });

  refresh();
  return {
    active: () => mode !== null || performance.now() - consumedAt < 400,
    cancel: stop,
    show(aoi, fit = false) {
      current = aoi && !isEmpty(aoi) ? aoi : null;
      setData("aoi", current ? aoiToGeoJson(current) : EMPTY);
      if (current) {
        bufferWidth(current);
        radiusInput.value = String(current.radius_km);
        if (fit) {
          const [w, s, e, n] = aoiBbox(current);
          map.fitBounds([[w, s], [e, n]], { padding: 48, maxZoom: 11, duration: 0 });
        }
      }
      refresh();
    },
  };
}
