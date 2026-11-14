import "./style.css";
import { formatMonth } from "@observablehq/plot";
import { availableSeries, type CountryCode, type IndexFile, type RegionFile, type Series } from "./lib/contract.ts";
import { csvFileName, filterCsvByRange } from "./lib/csv.ts";
import { dataUrl, loadIndex, loadRegion } from "./lib/data.ts";
import { parseLatLon, regionAt, type RegionCollection } from "./lib/geo.ts";
import { parseState, serializeState, type AppState } from "./lib/url-state.ts";
import { renderHeatmap } from "./charts/heatmap.ts";
import { defaultMonth, renderMedianPanel } from "./charts/median.ts";
import { createRegionMap } from "./map.ts";

const monthName = formatMonth("en", "short");
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const SERIES_BUTTON: Record<Series, string> = { harm: "Harmonized", modis: "MODIS", viirs: "VIIRS" };
const LEVEL_LABEL: Record<string, string> = {
  country: "Country",
  nuts2: "NUTS 2 regions",
  nuts3: "NUTS 3 regions",
  province: "Provinces",
  department: "Departments",
};

let state: AppState = parseState(location.search);
let index: IndexFile;
let geometry: RegionCollection = { type: "FeatureCollection", features: [] };
let region: RegionFile | null = null;
/** Month in the median panel; null = pick the default for the current range. */
let pickedYm: string | null = null;

const forceLocalBasemap = new URLSearchParams(location.search).get("basemap") === "local";

function pushState(): void {
  const extra = forceLocalBasemap ? "&basemap=local" : "";
  history.replaceState(null, "", serializeState(state) + extra + location.hash);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// ---------- area block: region dropdown + lat/lon ----------

function fillRegionSelect(): void {
  const groups = new Map<string, IndexFile["regions"]>();
  for (const r of index.regions) {
    if (!groups.has(r.level)) groups.set(r.level, []);
    groups.get(r.level)!.push(r);
  }
  const html = [...groups].map(([level, rs]) => {
    const sorted = level === "country" ? rs : [...rs].sort((a, b) => a.name.localeCompare(b.name));
    const opts = sorted.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}${r.level === "country" ? "" : ` (${escapeHtml(r.id)})`}</option>`);
    return `<optgroup label="${LEVEL_LABEL[level] ?? level}">${opts.join("")}</optgroup>`;
  });
  $<HTMLSelectElement>("#region").innerHTML = html.join("");
}

function onLatLon(e: Event): void {
  e.preventDefault();
  const msg = $("#latlon-msg");
  const p = parseLatLon($<HTMLInputElement>("#latlon").value);
  if (!p) {
    msg.textContent = "Enter decimal degrees, e.g. 40.64, 22.94";
    return;
  }
  const hit = regionAt(geometry, p.lon, p.lat);
  regionMap.showPoint([p.lon, p.lat]);
  if (!hit) {
    msg.textContent = `Not inside any ${index.country_name} region`;
    return;
  }
  msg.textContent = "";
  void selectRegion(hit.properties.id);
}

// ---------- region panel ----------

function rangeBounds(): { min: string; max: string } {
  return { min: index.period.start, max: index.period.end };
}

function renderPanel(): void {
  const panel = $("#panel");
  if (!region) {
    panel.innerHTML = `<p class="hint">Pick a region on the map or in the list.</p>`;
    return;
  }
  const s = region.summary;
  const options = availableSeries(region.mode);
  if (!options.includes(state.series)) state.series = options[0];
  const { min, max } = rangeBounds();

  panel.innerHTML = `
    <h2>${escapeHtml(region.name)} <span class="muted">${escapeHtml(region.id)}</span></h2>
    <p class="headline">Critical period <strong>${monthName(s.onset - 1)} to ${monthName(s.end - 1)}</strong>,
      peak <strong>${monthName(s.peak_month - 1)}</strong>${s.bimodal ? ", two seasons" : ""}</p>
    ${region.mode === "relative"
      ? `<p class="note">Relative mode: harmonization did not pass validation here, so the calendar shows MODIS 2000-2025 and VIIRS side by side.</p>`
      : ""}
    <div class="controls">
      <div class="toggle" role="group" aria-label="Series">
        ${options.map((o) => `<button type="button" data-series="${o}" aria-pressed="${o === state.series}">${SERIES_BUTTON[o]}</button>`).join("")}
      </div>
      <div class="range">
        <label>From <input id="from" type="month" min="${min}" max="${max}" value="${state.from ?? ""}" /></label>
        <label>To <input id="to" type="month" min="${min}" max="${max}" value="${state.to ?? ""}" /></label>
        <button type="button" id="range-clear" ${state.from || state.to ? "" : "hidden"}>Clear</button>
      </div>
      <button type="button" id="csv">Download CSV${state.from || state.to ? " (range)" : ""}</button>
    </div>
    <div id="chart"></div>
    <section id="median" aria-live="polite"></section>
    <p class="foot">Click a cell to compare that month with its median.
      2000-2011 back-cast from MODIS (range in the tooltip), 2012-2025 VIIRS observed.
      Outlined: above the 90th percentile of the preceding 10 years. ×: known MODIS outage.</p>`;

  const ym = pickedYm ?? defaultMonth(region, state.from, state.to);
  $("#chart").append(
    renderHeatmap(region, state.series, { from: state.from, to: state.to }, ym, (picked) => {
      pickedYm = picked;
      renderPanel();
    }),
  );
  $("#median").append(renderMedianPanel(region, ym));

  panel.querySelectorAll<HTMLButtonElement>("button[data-series]").forEach((b) =>
    b.addEventListener("click", () => {
      state.series = b.dataset.series as Series;
      pushState();
      renderPanel();
    }),
  );
  for (const key of ["from", "to"] as const) {
    $<HTMLInputElement>(`#${key}`).addEventListener("change", (e) => {
      const v = (e.target as HTMLInputElement).value;
      state[key] = v || null;
      if (state.from && state.to && state.from > state.to) [state.from, state.to] = [state.to, state.from];
      pickedYm = null;
      pushState();
      renderPanel();
    });
  }
  $("#range-clear").addEventListener("click", () => {
    state.from = state.to = null;
    pickedYm = null;
    pushState();
    renderPanel();
  });
  $("#csv").addEventListener("click", () => void downloadCsv());
}

async function downloadCsv(): Promise<void> {
  if (!region) return;
  const url = dataUrl(state.country, `regions/${encodeURIComponent(region.id)}.csv`);
  const name = csvFileName(state.country, region.id, state.from, state.to);
  let href = url;
  if (state.from || state.to) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    href = URL.createObjectURL(new Blob([filterCsvByRange(await res.text(), state.from, state.to)], { type: "text/csv" }));
  }
  const a = Object.assign(document.createElement("a"), { href, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  if (href !== url) setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// ---------- wiring ----------

async function selectRegion(id: string): Promise<void> {
  state.region = id;
  pushState();
  regionMap.setSelected(id);
  $<HTMLSelectElement>("#region").value = id;
  region = await loadRegion(state.country, id);
  pickedYm = null;
  renderPanel();
}

async function setCountry(country: CountryCode): Promise<void> {
  state.country = country;
  index = await loadIndex(country);
  $<HTMLSelectElement>("#country").value = country;
  fillRegionSelect();
  regionMap.showPoint(null);
  $("#latlon-msg").textContent = "";
  geometry = await regionMap.setCountry(country, index);
  const known = index.regions.some((r) => r.id === state.region);
  await selectRegion(known && state.region ? state.region : index.regions[0].id);
}

const regionMap = await createRegionMap($("#map"), (id) => void selectRegion(id), forceLocalBasemap);

$<HTMLSelectElement>("#country").addEventListener("change", (e) => {
  state.region = null;
  void setCountry((e.target as HTMLSelectElement).value as CountryCode);
});
$<HTMLSelectElement>("#region").addEventListener("change", (e) => void selectRegion((e.target as HTMLSelectElement).value));
$("#latlon-form").addEventListener("submit", onLatLon);

await setCountry(state.country);
