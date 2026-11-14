import "@fontsource-variable/ibm-plex-sans";
import "./style.css";
import { formatMonth } from "@observablehq/plot";
import { availableSeries, type CountryCode, type IndexFile, type RegionFile, type Series } from "./lib/contract.ts";
import { csvFileName, filterCsvByRange } from "./lib/csv.ts";
import { dataUrl, loadIndex, loadRegion } from "./lib/data.ts";
import { parseLatLon, regionAt, type RegionCollection } from "./lib/geo.ts";
import { parseState, serializeState, type AppState } from "./lib/url-state.ts";
import { marksKey, renderHeatmap } from "./charts/heatmap.ts";
import { renderContextPanel } from "./charts/context.ts";
import { defaultMonth, renderMedianPanel } from "./charts/median.ts";
import { rampColors } from "./charts/ramp.ts";
import { renderValidation } from "./charts/validation.ts";
import { createRegionMap } from "./map.ts";

const monthName = formatMonth("en", "short");
const monthInitial = formatMonth("en", "narrow");
const RAMP_11 = rampColors(11);
const [SEASON_FILL, PEAK_FILL] = [RAMP_11[3], RAMP_11[7]];
const LATLON_EXAMPLE: Record<CountryCode, string> = { gr: "40.64, 22.94", ar: "-31.73, -60.53" };
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
/** Chart width of the last render; a resize re-renders only when it changes for real. */
let lastWidth = 0;
/** Increments per region load; a slower, older response must not overwrite a newer one. */
let loadToken = 0;

const DOWNLOAD_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11"/></svg>`;

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

/** 12 cells Jan-Dec: the critical period filled (it may wrap over the new year), the peak darker. */
function seasonStrip(onset: number, end: number, peak: number): string {
  const inSeason = (m: number) => (onset <= end ? m >= onset && m <= end : m >= onset || m <= end);
  const cells = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const cls = m === peak ? "peak" : inSeason(m) ? "in" : "";
    return `<span class="${cls}">${monthInitial(i)}</span>`;
  });
  return `<div class="season" aria-hidden="true" style="--season:${SEASON_FILL};--peak:${PEAK_FILL}">${cells.join("")}</div>`;
}

/** Chart width: the panel's content box, capped so the calendar cells stay compact. */
function chartWidth(): number {
  return Math.max(280, Math.min(640, Math.floor($("#chart").clientWidth)));
}

/** Selector that finds the focused panel control again after renderPanel replaces the markup. */
function focusSelector(el: Element | null): string | null {
  if (!el || !$("#panel").contains(el)) return null;
  if (el.id) return `#${el.id}`;
  const series = (el as HTMLElement).dataset?.series;
  return series ? `button[data-series="${series}"]` : null;
}

/** Arrow keys on the calendar move the compared month: left/right one month, up/down one year. */
function onChartKey(e: KeyboardEvent): void {
  if (!region) return;
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 }[e.key];
  if (!step) return;
  e.preventDefault();
  const yms = region.months.map((m) => m.ym);
  const current = pickedYm ?? defaultMonth(region, state.from, state.to);
  const i = yms.indexOf(current);
  const next = yms[Math.max(0, Math.min(yms.length - 1, i + step))];
  if (next && next !== current) {
    pickedYm = next;
    renderPanel();
  }
}

function showError(message: string, retry: () => void): void {
  const panel = $("#panel");
  panel.innerHTML = `<div class="error" role="alert"><p>${escapeHtml(message)}</p>
    <button type="button" class="btn" id="retry">Try again</button></div>`;
  $("#retry").addEventListener("click", retry);
}

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

  const hasRange = !!(state.from || state.to);
  const refocus = focusSelector(document.activeElement);
  panel.innerHTML = `
    <div class="region-head">
      <h2>${escapeHtml(region.name)} <span class="region-id">${escapeHtml(region.id)}</span></h2>
      <p class="headline">Critical period <strong>${monthName(s.onset - 1)} to ${monthName(s.end - 1)}</strong>,
        peak <strong>${monthName(s.peak_month - 1)}</strong>${s.bimodal ? ", two seasons" : ""}</p>
      ${seasonStrip(s.onset, s.end, s.peak_month)}
    </div>
    ${region.mode === "relative"
      ? `<p class="note">Relative mode: harmonization did not pass validation here, so the calendar shows MODIS 2000-2025 and VIIRS as separate series.</p>`
      : ""}
    <div class="controls">
      <div class="controls-row">
        <div class="toggle" role="group" aria-label="Series">
          ${options.map((o) => `<button type="button" data-series="${o}" aria-pressed="${o === state.series}">${SERIES_BUTTON[o]}</button>`).join("")}
        </div>
        <button type="button" id="csv" class="btn">${DOWNLOAD_ICON}Download CSV${hasRange ? " (range)" : ""}</button>
      </div>
      <div class="range">
        <label>From <input id="from" type="month" min="${min}" max="${max}" value="${state.from ?? ""}" /></label>
        <label>To <input id="to" type="month" min="${min}" max="${max}" value="${state.to ?? ""}" /></label>
        <button type="button" id="range-clear" class="btn btn-quiet" ${hasRange ? "" : "hidden"}>Clear range</button>
      </div>
    </div>
    <div id="chart" tabindex="0" role="group" aria-label="Burning calendar, years by months. Arrow keys change the month compared below."></div>
    ${marksKey(state.series, hasRange)}
    <p class="foot">${matchMedia("(pointer: coarse)").matches ? "Tap" : "Click"} a cell to compare that month with its median.${state.series === "harm"
      ? " 2000-2011 back-cast from MODIS (range in the tooltip), 2012-2025 VIIRS observed."
      : ""}</p>
    <section id="median" aria-live="polite"></section>
    <section id="context" aria-live="polite"></section>
    <div id="method"></div>`;

  const ym = pickedYm ?? defaultMonth(region, state.from, state.to);
  const width = chartWidth();
  lastWidth = width;
  $("#chart").append(
    renderHeatmap(region, state.series, { from: state.from, to: state.to }, ym, (picked) => {
      pickedYm = picked;
      renderPanel();
    }, width),
  );
  $("#median").append(renderMedianPanel(region, ym, width));
  const ctx = renderContextPanel(region, ym);
  if (ctx) $("#context").append(ctx);
  $("#method").append(renderValidation(region, state.country, width));
  $("#chart").addEventListener("keydown", onChartKey);

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
  if (refocus) panel.querySelector<HTMLElement>(refocus)?.focus({ preventScroll: true });
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
  const panel = $("#panel");
  const token = ++loadToken;
  panel.setAttribute("aria-busy", "true");
  try {
    const loaded = await loadRegion(state.country, id);
    if (token !== loadToken) return;
    region = loaded;
  } catch {
    if (token === loadToken) showError(`Could not load the data for ${id}. Check the connection.`, () => void selectRegion(id));
    return;
  } finally {
    if (token === loadToken) panel.removeAttribute("aria-busy");
  }
  pickedYm = null;
  renderPanel();
}

async function setCountry(country: CountryCode): Promise<void> {
  state.country = country;
  try {
    index = await loadIndex(country);
  } catch {
    showError("Could not load the region list. Check the connection.", () => void setCountry(country));
    return;
  }
  document.querySelectorAll<HTMLButtonElement>("#country button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.country === country)),
  );
  $<HTMLInputElement>("#latlon").placeholder = LATLON_EXAMPLE[country];
  fillRegionSelect();
  regionMap.showPoint(null);
  $("#latlon-msg").textContent = "";
  geometry = await regionMap.setCountry(country, index);
  const known = index.regions.some((r) => r.id === state.region);
  await selectRegion(known && state.region ? state.region : index.regions[0].id);
}

const regionMap = await createRegionMap($("#map"), (id) => void selectRegion(id), forceLocalBasemap);

document.querySelectorAll<HTMLButtonElement>("#country button").forEach((b) =>
  b.addEventListener("click", () => {
    const country = b.dataset.country as CountryCode;
    if (country === state.country) return;
    state.region = null;
    void setCountry(country);
  }),
);
new ResizeObserver(() => {
  if (region && document.querySelector("#chart") && Math.abs(chartWidth() - lastWidth) > 8) renderPanel();
}).observe($("#panel"));
$<HTMLSelectElement>("#region").addEventListener("change", (e) => void selectRegion((e.target as HTMLSelectElement).value));
$("#latlon-form").addEventListener("submit", onLatLon);

await setCountry(state.country);
