// Panel "Context" for the chosen month: fire weather, drought and land cover next to the detections.
import type { RegionFile } from "../lib/contract.ts";
import { contextFor, FWI_WORDS, SPEI_WORDS } from "../lib/context.ts";

const monthYear = (ym: string) =>
  new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Returns null when the region has no context data, so the caller shows nothing. */
export function renderContextPanel(region: RegionFile, ym: string): HTMLElement | null {
  const c = contextFor(region, ym);
  if (!c) return null;
  const el = document.createElement("div");
  el.className = "context";
  const rows: string[] = [];
  if (c.fwi) {
    const lvl = c.fwi.level;
    rows.push(`<li><span class="ctx-name">Fire weather (FWI)</span>
      <strong>${c.fwi.value.toFixed(1)}</strong>${c.fwi.pct != null ? `, percentile ${Math.round(c.fwi.pct)} of all ${monthYear(ym).split(" ")[0]}s` : ""}
      ${lvl ? `<span class="ctx-badge ctx-${lvl}">${FWI_WORDS[lvl]}</span>` : ""}</li>`);
  }
  for (const s of c.spei) {
    rows.push(`<li><span class="ctx-name">Drought (${s.label})</span>
      <strong>${s.value.toFixed(2)}</strong>
      ${s.level ? `<span class="ctx-badge ctx-${s.level}">${SPEI_WORDS[s.level]}</span>` : ""}</li>`);
  }
  const lc = c.landcover;
  const bar = lc
    ? `<div class="lc" role="img" aria-label="Land cover: cropland ${lc.cropland_pct} %, trees ${lc.tree_pct} %, shrub and grass ${lc.shrub_grass_pct} %, other ${lc.other_pct} %">
         <span class="lc-crop" style="width:${lc.cropland_pct}%"></span><span class="lc-tree" style="width:${lc.tree_pct}%"></span><span class="lc-shrub" style="width:${lc.shrub_grass_pct}%"></span><span class="lc-other" style="width:${lc.other_pct}%"></span>
       </div>
       <p class="lc-key">Land cover (${esc(lc.source)}): cropland ${lc.cropland_pct} %, trees ${lc.tree_pct} %, shrub and grass ${lc.shrub_grass_pct} %. Agricultural burning follows the farming calendar more than the weather.</p>`
    : "";
  el.innerHTML = `
    <h3>Context for ${monthYear(ym)}</h3>
    ${rows.length ? `<ul class="ctx-list">${rows.join("")}</ul>` : ""}
    ${bar}
    <p class="hint">Weather and drought go with more or less fire but do not explain a single month. Grid cells are 25 km (FWI) and 50 km (SPEI), averaged over the region.</p>`;
  return el;
}
