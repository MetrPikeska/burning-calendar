import "@fontsource-variable/ibm-plex-sans";
import "./style.css";
import { formatMonth } from "@observablehq/plot";
import { availableSeries, shownSeries, type CountryCode, type IndexFile, type RegionFile, type Series } from "./lib/contract.ts";
import { csvFileName, filterCsvByRange } from "./lib/csv.ts";
import { nowText, type RecentBody } from "./lib/now.ts";
import { buildReport, reportFileName } from "./lib/report.ts";
import { dataUrl, loadIndex, loadRegion } from "./lib/data.ts";
import { parseLatLon, regionAt, type RegionCollection } from "./lib/geo.ts";
import { parseState, serializeState, type AppState } from "./lib/url-state.ts";
import { marksKey, renderHeatmap } from "./charts/heatmap.ts";
import { defaultMonth, renderMedianPanel } from "./charts/median.ts";
import { rampColors } from "./charts/ramp.ts";
import { renderValidation } from "./charts/validation.ts";
import { createRegionMap } from "./map.ts";
import { initAgentPanel } from "./ui/agent-panel.ts";

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

/** URL state; `series` is the user's choice, the panel shows shownSeries(region.mode, state.series). */
let state: AppState = parseState(location.search);
let index: IndexFile;
let geometry: RegionCollection = { type: "FeatureCollection", features: [] };
let region: RegionFile | null = null;
/** Month in the median panel; null = pick the default for the current range. */
let pickedYm: string | null = null;
/** Open state of the collapsible panel sections, kept across re-renders. */
let methodOpen = false;
let rangeOpen = false;
/** Chart width of the last render; a resize re-renders only when it changes for real. */
let lastWidth = 0;
/** Increments per region load; a slower, older response must not overwrite a newer one. */
let loadToken = 0;
/** True while a region load is in flight; country of the shown region, ids are unique per country only. */
let loading = false;
let dimTimer: ReturnType<typeof setTimeout> | undefined;
let regionCountry: CountryCode | null = null;

const DOWNLOAD_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11"/></svg>`;

const CHEVRON_LEFT = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>`;
const CHEVRON_RIGHT = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>`;

const forceLocalBasemap = new URLSearchParams(location.search).get("basemap") === "local";

function pushState(): void {
  const extra = forceLocalBasemap ? "&basemap=local" : "";
  history.replaceState(null, "", serializeState(state) + extra + location.hash);
}

/**
 * Resolves after the browser has painted the current frame: rAF runs before the paint, the
 * timeout after it. Heavy rendering waits for this, so the busy state shows first.
 */
function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
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
  // Immediate, cheap feedback (also read out: the message is role=status); the panel follows.
  msg.textContent = `Inside ${hit.properties.name} (${hit.properties.id})`;
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

/** Moves the compared month by `step` months, clamped to the region's record. */
function stepMonth(step: number): void {
  if (!region) return;
  const yms = region.months.map((m) => m.ym);
  const current = pickedYm ?? defaultMonth(region, state.from, state.to);
  const i = yms.indexOf(current);
  const next = yms[Math.max(0, Math.min(yms.length - 1, i + step))];
  if (next && next !== current) {
    pickedYm = next;
    renderPanel();
  }
}

/** Arrow keys on the calendar move the compared month: left/right one month, up/down one year. */
function onChartKey(e: KeyboardEvent): void {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 }[e.key];
  if (!step) return;
  e.preventDefault();
  stepMonth(step);
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
  // A relative region shows MODIS without overwriting the choice, which comes back on a harmonized region.
  const series = shownSeries(region.mode, state.series);
  const { min, max } = rangeBounds();
  const endYear = index.period.end.slice(0, 4);
  const provFrom = index.period.provisional_from;
  const provisionalNote = provFrom ? ` (from ${provFrom} near real-time, provisional)` : "";

  const hasRange = !!(state.from || state.to);
  const refocus = focusSelector(document.activeElement);
  const narrow = matchMedia("(max-width: 900px)").matches;
  const ym = pickedYm ?? defaultMonth(region, state.from, state.to);
  const atStart = ym === region.months[0]?.ym;
  const atEnd = ym === region.months[region.months.length - 1]?.ym;
  const rangeHtml = `<div class="range">
        <label>From <input id="from" type="month" min="${min}" max="${max}" value="${state.from ?? ""}" /></label>
        <label>To <input id="to" type="month" min="${min}" max="${max}" value="${state.to ?? ""}" /></label>
        <button type="button" id="range-clear" class="btn btn-quiet" ${hasRange ? "" : "hidden"}>Clear range</button>
      </div>`;
  panel.innerHTML = `
    <div class="region-head">
      <h2>${escapeHtml(region.name)} <span class="region-id">${escapeHtml(region.id)}</span></h2>
      <p class="headline">Critical period <strong>${monthName(s.onset - 1)} to ${monthName(s.end - 1)}</strong>,
        peak <strong>${monthName(s.peak_month - 1)}</strong>${s.bimodal ? ", two seasons" : ""}</p>
      ${seasonStrip(s.onset, s.end, s.peak_month)}
    </div>
    ${region.mode === "relative"
      ? `<p class="note">Relative mode: harmonization did not pass validation here, so the calendar shows MODIS 2000-${endYear} and VIIRS as separate series.</p>`
      : ""}
    <div class="median-card">
      <div class="stepper" role="group" aria-label="Compared month">
        <button type="button" id="month-prev" class="btn btn-icon" aria-label="Previous month" ${atStart ? "disabled" : ""}>${CHEVRON_LEFT}</button>
        <button type="button" id="month-next" class="btn btn-icon" aria-label="Next month" ${atEnd ? "disabled" : ""}>${CHEVRON_RIGHT}</button>
      </div>
      <section id="median" aria-live="polite"></section>
      <p id="now" class="now" hidden></p>
    </div>
    <div class="controls">
      <div class="controls-row">
        <div class="toggle" role="group" aria-label="Series">
          ${options.map((o) => `<button type="button" data-series="${o}" aria-pressed="${o === series}">${SERIES_BUTTON[o]}</button>`).join("")}
        </div>
        <div class="downloads" role="group" aria-label="Downloads">
          <button type="button" id="csv" class="btn">${DOWNLOAD_ICON}Download CSV${hasRange ? " (range)" : ""}</button>
          ${state.country === "gr" ? `<a id="hotspots" class="btn btn-quiet" href="${dataUrl(state.country, `detections/${encodeURIComponent(region.id)}.csv`)}" download="burning-calendar_gr_${escapeHtml(region.id)}_hotspots.csv" title="Every detection after filters: date, time, sensor, lat/lon, FRP (2000-11 to ${index.period.end})">${DOWNLOAD_ICON}Hotspots CSV</a>` : ""}
          <button type="button" id="report" class="btn btn-quiet" title="Markdown report: this month vs the median, monthly values, validation, sources, limits, citation">${DOWNLOAD_ICON}Report</button>
        </div>
      </div>
      ${narrow ? `<details class="range-details" ${rangeOpen || hasRange ? "open" : ""}><summary>Date range${hasRange ? `: ${state.from ?? "start"} to ${state.to ?? "end"}` : ""}</summary>${rangeHtml}</details>` : rangeHtml}
    </div>
    <div id="chart" tabindex="0" role="group" aria-label="Burning calendar, years by months. Arrow keys change the compared month."></div>
    ${marksKey(hasRange)}
    <p class="foot">${matchMedia("(pointer: coarse)").matches ? "Tap" : "Click"} a cell or use the arrows to compare another month.${series === "harm"
      ? ` Nov 2000 to Jan 2012 back-cast from MODIS (range in the tooltip), Feb 2012 to ${endYear} VIIRS observed${provisionalNote}.`
      : ""}</p>
    <details class="method-details" ${methodOpen ? "open" : ""}>
      <summary>How well the harmonization holds here</summary>
      <div id="method"></div>
    </details>`;

  const width = chartWidth();
  lastWidth = width;
  $("#chart").append(
    renderHeatmap(region, series, { from: state.from, to: state.to }, ym, (picked) => {
      pickedYm = picked;
      renderPanel();
    }, width),
  );
  $("#median").append(renderMedianPanel(region, ym, width, series));
  showNow(region.id);
  $("#method").append(renderValidation(region, state.country, width));
  $("#chart").addEventListener("keydown", onChartKey);
  $("#month-prev").addEventListener("click", () => stepMonth(-1));
  $("#month-next").addEventListener("click", () => stepMonth(1));
  panel.querySelector(".method-details")?.addEventListener("toggle", (e) => {
    methodOpen = (e.target as HTMLDetailsElement).open;
  });
  panel.querySelector(".range-details")?.addEventListener("toggle", (e) => {
    rangeOpen = (e.target as HTMLDetailsElement).open;
  });

  panel.querySelectorAll<HTMLButtonElement>("button[data-series]").forEach((b) =>
    b.addEventListener("click", () => {
      // Pressing the series already shown is not a choice; it must not pin a series forced by relative mode.
      if (b.dataset.series === series) return;
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
  $("#report").addEventListener("click", () => downloadReport(ym));
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

function downloadReport(ym: string): void {
  if (!region) return;
  const md = buildReport({
    index, region, ym, from: state.from, to: state.to,
    viewUrl: new URL(serializeState(state), location.origin + location.pathname).href,
    csvUrl: new URL(dataUrl(state.country, `regions/${encodeURIComponent(region.id)}.csv`), location.origin).href,
    today: new Date().toISOString().slice(0, 10),
  });
  const href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
  const a = Object.assign(document.createElement("a"), { href, download: reportFileName(state.country, region.id, ym) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// ---------- "Now": FIRMS near real-time, last 3 days (api/recent.ts) ----------

const NOW_TTL_MS = 10 * 60_000;
const nowCache = new Map<string, { at: number; body: RecentBody | null }>();

function paintNow(id: string, body: RecentBody | null): void {
  const el = document.querySelector<HTMLElement>("#now");
  if (!el || region?.id !== id) return;
  // Hidden on any failure (offline demo, missing key, upstream down): the calendar stays the answer.
  if (!body || !body.configured || body.sources_failed?.length) {
    el.hidden = true;
    return;
  }
  el.innerHTML = nowText(body);
  el.hidden = false;
}

function showNow(id: string): void {
  const hit = nowCache.get(id);
  // A failure is retried after a minute, a good answer after 10 (the CDN caches it for 15).
  if (hit && Date.now() - hit.at < (hit.body ? NOW_TTL_MS : 60_000)) {
    paintNow(id, hit.body);
    return;
  }
  fetch(`/api/recent?region=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? (r.json() as Promise<RecentBody>) : null))
    .catch(() => null)
    .then((body) => {
      nowCache.set(id, { at: Date.now(), body });
      paintNow(id, body);
    });
}

// ---------- wiring ----------

async function selectRegion(id: string): Promise<void> {
  // Same region as shown (a second Find inside it, a map click on it): nothing to reload or redraw.
  if (region?.id === id && regionCountry === state.country && state.region === id && !loading) return;
  state.region = id;
  pushState();
  regionMap.setSelected(id);
  $<HTMLSelectElement>("#region").value = id;
  const panel = $("#panel");
  const token = ++loadToken;
  loading = true;
  panel.setAttribute("aria-busy", "true");
  // Dim only a slow load: a fast one swaps the panel before the dimming would show, and
  // painting it into the interaction's frame cost more than it told the user.
  clearTimeout(dimTimer);
  dimTimer = setTimeout(() => panel.classList.add("loading"), 150);
  let loaded: RegionFile;
  try {
    loaded = await loadRegion(state.country, id);
    if (token !== loadToken) return;
    // Let the map selection, the marker and the status text paint before the panel is rebuilt.
    await afterNextPaint();
    if (token !== loadToken) return;
  } catch {
    if (token === loadToken) {
      endLoad(panel);
      showError(`Could not load the data for ${id}. Check the connection.`, () => void selectRegion(id));
    }
    return;
  }
  region = loaded;
  regionCountry = state.country;
  pickedYm = null;
  renderPanel();
  endLoad(panel);
}

function endLoad(panel: HTMLElement): void {
  loading = false;
  clearTimeout(dimTimer);
  panel.classList.remove("loading");
  panel.removeAttribute("aria-busy");
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

initAgentPanel($("#ai-open"));
/** A pick from the map or the list makes an old lat/lon message stale. */
function pickRegion(id: string): void {
  $("#latlon-msg").textContent = "";
  void selectRegion(id);
}

const regionMap = await createRegionMap($("#map"), pickRegion, forceLocalBasemap);

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
$<HTMLSelectElement>("#region").addEventListener("change", (e) => pickRegion((e.target as HTMLSelectElement).value));
$("#latlon-form").addEventListener("submit", onLatLon);
const latlonDetails = $<HTMLDetailsElement>("#latlon-details");
latlonDetails.addEventListener("toggle", () => {
  if (latlonDetails.open) $<HTMLInputElement>("#latlon").focus();
});
latlonDetails.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && latlonDetails.open) {
    latlonDetails.open = false;
    latlonDetails.querySelector("summary")?.focus();
  }
});

await setCountry(state.country);
