// Panel "how well the harmonization holds here": back-cast check per region, from regions/{id}.json -> validation.
import * as Plot from "@observablehq/plot";
import { type CountryCode, type RegionFile, type RegionValidation, worstYearText } from "../lib/contract.ts";
import { dataUrl } from "../lib/data.ts";

/** Mode rule: relative when the LOYO median annual error is above this (docs/wiki/decisions.md). */
const MDAPE_LIMIT = 25;
const LOYO_FILL = "#3d3833";
const TEST_FILL = "#a3978b";

const pct = (n: number | null | undefined) => (n == null ? "n/a" : `${n.toFixed(1)} %`);

interface ErrRow {
  year: number;
  err: number;
  kind: string;
}

function errRows(v: RegionValidation): { rows: ErrRow[]; loyoKind: string; testKind: string } {
  const loyoYears = v.loyo?.years ?? [];
  const loyoKind = loyoYears.length ? `Left-out year (${loyoYears[0]}-${loyoYears[loyoYears.length - 1]})` : "Left-out year";
  const testKind = `Held-out test (${v.time_split?.test ?? "2020-2025"})`;
  const rows: ErrRow[] = [];
  for (const [kind, errs] of [[loyoKind, v.loyo?.annual_err_pct], [testKind, v.time_split?.annual_err_pct]] as const) {
    for (const [y, e] of Object.entries(errs ?? {})) if (e != null) rows.push({ year: Number(y), err: e, kind });
  }
  return { rows: rows.sort((a, b) => a.year - b.year), loyoKind, testKind };
}

export function renderValidation(region: RegionFile, country: CountryCode, width = 520): HTMLElement {
  const el = document.createElement("section");
  el.className = "method";
  el.setAttribute("aria-label", "Validation of the harmonization");
  const v = region.validation as RegionValidation;
  const loyo = v.loyo;
  if (!loyo) {
    el.innerHTML = `<h3>How well the harmonization holds here</h3><p class="hint">No validation record for this region.</p>`;
    return el;
  }
  const ts = v.time_split;
  const season = loyo.season;
  const nSeasons = season?.season_years.length ?? 0;
  // The error limit is restated in the numbers below, so only other reasons are spelled out here.
  const otherReasons = (v.mode_reasons ?? []).filter((r) => !r.startsWith("loyo_mdape"));
  const q = v.quality;
  const limited = region.mode === "harmonized" && q?.level === "limited" && q.worst_err_pct != null;
  const verdict = region.mode === "harmonized"
    ? limited
      ? `<strong>Passed validation, with limits:</strong> worst held-out year ${worstYearText(q!)}, ${q!.worst_err_pct! > 0 ? "+" : ""}${q!.worst_err_pct!.toFixed(1)} % against observed VIIRS.`
      : `<strong>Passed validation.</strong>`
    : `<strong>Did not pass</strong>${otherReasons.length ? `: ${otherReasons.join("; ")}` : ""}, so the calendar shows MODIS and VIIRS counts as they are.`;
  const peak = season?.harm && season.modis_raw && nSeasons
    ? ` Peak month right in ${season.harm.peak_hits} of ${nSeasons} left-out seasons (raw MODIS ${season.modis_raw.peak_hits} of ${nSeasons}).`
    : "";
  const r = loyo.monthly?.r;

  el.innerHTML = `
    <h3>How well the harmonization holds here</h3>
    <p>${verdict} Leave-one-year-out on ${loyo.years[0]}-${loyo.years[loyo.years.length - 1]}: median annual error
      <strong>${pct(loyo.annual_mdape_pct)}</strong> (limit ${MDAPE_LIMIT} %)${r != null ? `, monthly correlation ${r.toFixed(2)}` : ""}.
      ${ts ? `Held-out years ${ts.test}: <strong>${pct(ts.annual_mdape_pct)}</strong>.` : ""}${peak}</p>`;

  const { rows, loyoKind, testKind } = errRows(v);
  if (rows.length) {
    const maxAbs = Math.min(120, Math.max(35, ...rows.map((d) => Math.abs(d.err))));
    const narrow = width < 440;
    const fig = document.createElement("figure");
    fig.className = "method-chart";
    fig.innerHTML = `<figcaption>Annual total modelled from MODIS minus VIIRS observed, in % of observed</figcaption>`;
    fig.append(
      Plot.plot({
        width,
        height: 150,
        marginLeft: 36,
        marginRight: 4,
        marginTop: 8,
        style: { fontFamily: "inherit", fontSize: "12px" },
        x: { type: "band", label: null, tickSize: 0, tickFormat: (y: number) => (narrow ? `'${String(y).slice(2)}` : String(y)), padding: 0.25 },
        y: { label: null, domain: [-maxAbs, maxAbs], ticks: [-MDAPE_LIMIT, 0, MDAPE_LIMIT], tickFormat: (n: number) => `${n > 0 ? "+" : ""}${n}`, clamp: true },
        color: { domain: [loyoKind, testKind], range: [LOYO_FILL, TEST_FILL], legend: false },
        marks: [
          Plot.ruleY([-MDAPE_LIMIT, MDAPE_LIMIT], { stroke: "#c5bbb0", strokeDasharray: "3,3" }),
          Plot.barY(rows, { x: "year", y: "err", fill: "kind", title: (d: ErrRow) => `${d.year}: ${d.err > 0 ? "+" : ""}${d.err.toFixed(1)} %\n${d.kind}` , tip: true }),
          Plot.ruleY([0], { stroke: "#1d1b19" }),
        ],
      }),
    );
    const key = document.createElement("ul");
    key.className = "key";
    key.innerHTML = [[LOYO_FILL, loyoKind], [TEST_FILL, testKind]]
      .map(([c, t]) => `<li><svg width="12" height="12" aria-hidden="true"><rect width="12" height="12" fill="${c}"/></svg><span>${t}</span></li>`)
      .join("") + `<li><svg width="16" height="12" aria-hidden="true"><line x1="0" x2="16" y1="6" y2="6" stroke="#c5bbb0" stroke-dasharray="3,3"/></svg><span>±${MDAPE_LIMIT} %</span></li>`;
    fig.append(key);
    el.append(fig);
  }

  const links = document.createElement("p");
  links.className = "foot";
  links.innerHTML = `${region.mode === "harmonized"
    ? "Back-cast months (before Feb 2012) carry a likely range, shown in the tooltip and in the month card. "
    : ""}Full numbers: <a href="${dataUrl(country, "validation.json")}">validation.json</a>,
    <a href="${dataUrl(country, `regions/${encodeURIComponent(region.id)}.json`)}">region JSON</a>.`;
  el.append(links);
  return el;
}
