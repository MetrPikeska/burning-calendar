import "./style.css";
import { formatMonth } from "@observablehq/plot";
import { availableSeries, type CountryCode, type IndexFile, type RegionFile, type Series } from "./lib/contract.ts";
import { loadIndex, loadRegion } from "./lib/data.ts";
import { parseState, serializeState, type AppState } from "./lib/url-state.ts";
import { renderHeatmap } from "./charts/heatmap.ts";
import { createRegionMap } from "./map.ts";

const monthName = formatMonth("en", "short");
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const SERIES_BUTTON: Record<Series, string> = { harm: "Harmonized", modis: "MODIS", viirs: "VIIRS" };

let state: AppState = parseState(location.search);
let index: IndexFile;
let region: RegionFile | null = null;

const forceLocalBasemap = new URLSearchParams(location.search).get("basemap") === "local";

function pushState(): void {
  const extra = forceLocalBasemap ? "&basemap=local" : "";
  history.replaceState(null, "", serializeState(state) + extra + location.hash);
}

function renderPanel(): void {
  const panel = $("#panel");
  if (!region) {
    panel.innerHTML = `<p class="hint">Click a region on the map.</p>`;
    return;
  }
  const s = region.summary;
  const options = availableSeries(region.mode);
  if (!options.includes(state.series)) state.series = options[0];

  panel.innerHTML = `
    <h2>${escapeHtml(region.name)} <span class="muted">${escapeHtml(region.id)}</span></h2>
    <p class="headline">Critical period <strong>${monthName(s.onset - 1)} to ${monthName(s.end - 1)}</strong>,
      peak <strong>${monthName(s.peak_month - 1)}</strong>${s.bimodal ? ", two seasons" : ""}</p>
    ${region.mode === "relative"
      ? `<p class="note">Relative mode: harmonization did not pass validation here, so the calendar shows MODIS 2000-2025 and VIIRS side by side.</p>`
      : ""}
    <div class="toggle" role="group" aria-label="Series">
      ${options.map((o) => `<button data-series="${o}" aria-pressed="${o === state.series}">${SERIES_BUTTON[o]}</button>`).join("")}
    </div>
    <div id="chart"></div>
    <p class="foot">2000-2011 back-cast from MODIS (range in the tooltip), 2012-2025 VIIRS observed.
      Outlined: above the 90th percentile of the preceding 10 years. ×: known satellite outage.</p>`;

  $("#chart").append(renderHeatmap(region, state.series));
  panel.querySelectorAll<HTMLButtonElement>("button[data-series]").forEach((b) =>
    b.addEventListener("click", () => {
      state.series = b.dataset.series as Series;
      pushState();
      renderPanel();
    }),
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function selectRegion(id: string): Promise<void> {
  state.region = id;
  pushState();
  regionMap.setSelected(id);
  region = await loadRegion(state.country, id);
  renderPanel();
}

async function setCountry(country: CountryCode): Promise<void> {
  state.country = country;
  index = await loadIndex(country);
  $<HTMLSelectElement>("#country").value = country;
  await regionMap.setCountry(country, index);
  const known = index.regions.some((r) => r.id === state.region);
  await selectRegion(known && state.region ? state.region : index.regions[0].id);
}

const regionMap = await createRegionMap(
  $("#map"),
  (id) => void selectRegion(id),
  forceLocalBasemap,
);

$<HTMLSelectElement>("#country").addEventListener("change", (e) => {
  state.region = null;
  void setCountry((e.target as HTMLSelectElement).value as CountryCode);
});

await setCountry(state.country);
