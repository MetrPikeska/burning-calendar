// show_calendar: MCP Apps render tool (extension io.modelcontextprotocol/ui, spec 2026-01-26) plus its ui:// resource.
// Data logic is pure and reuses tools.ts; the HTML view is in widget-html.ts. Wiki: docs/wiki/agent-access.md, MCP Apps.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { MonthRecord, RegionFile, Series } from "../../src/lib/contract.ts";
import { countryOf, type Period, regionSeries, viewUrl } from "./tools.ts";
import { CALENDAR_HTML } from "./widget-html.ts";

/** Same values as RESOURCE_MIME_TYPE and RESOURCE_URI_META_KEY in @modelcontextprotocol/ext-apps 2.0.4 (server/index.js). */
export const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
const LEGACY_RESOURCE_URI_KEY = "ui/resourceUri";
/** Bump the version in the URI when the HTML changes, so hosts that cache ui:// resources fetch the new one. */
export const CALENDAR_URI = "ui://burning-calendar/calendar-v1.html";

/** Same labels as the web calendar (web/src/charts/heatmap.ts). */
const SERIES_LABEL: Record<Series, string> = {
  harm: "Harmonized (VIIRS-equivalent)",
  modis: "MODIS (Terra + Aqua)",
  viirs: "VIIRS S-NPP",
};

/** Text from NUTS / IGN names: drop C0/C1 controls, bidi overrides and zero-width characters, cap the length. */
export function safeText(s: string, max = 80): string {
  return s.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, "").trim().slice(0, max);
}

const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

/** One calendar cell: value of the shown series, the back-cast range on harm, anomaly and outage flags. Nulls omitted. */
function cell(m: MonthRecord, series: Series, mode: RegionFile["mode"]) {
  const v = series === "harm" ? r1(m.harm) : m[series];
  const backcast = series === "harm" && m.src !== "observed";
  // data/outages.csv lists MODIS (Aqua) gaps only: they matter where the shown value comes from MODIS.
  const outage = m.outage && (series === "modis" || backcast || (series === "harm" && mode === "relative"));
  return {
    ym: m.ym,
    v,
    ...(backcast ? { lo: r1(m.harm_lo), hi: r1(m.harm_hi) } : {}),
    src: m.src,
    ...(m.anom ? { anom: true } : {}),
    ...(outage ? { outage: true } : {}),
  };
}

/**
 * Everything the calendar widget draws, plus the usual tool fields (caveats, links, calendar-year totals).
 * Default range is the whole coverage; default series is harm (harmonized) or modis (relative).
 */
export function calendarData(region: RegionFile, p: { from?: string; to?: string; series?: Series }, period: Period) {
  const country = countryOf(region.id)!;
  const anomalySeries: Series = region.mode === "harmonized" ? "harm" : "modis";
  const series = p.series ?? anomalySeries;
  if (series === "harm" && region.mode !== "harmonized") {
    throw new Error(`Region ${region.id} is in relative mode and has no harmonized series; use series "modis" or "viirs", or leave series out.`);
  }
  // regionSeries checks from <= to, clips to coverage and builds caveats and links; year mode has no record cap.
  const base = regionSeries(region, { from: p.from ?? period.start, to: p.to ?? period.end, aggregate: "year" }, period);
  const { records, aggregate: _aggregate, ...rest } = base;
  const ret = base.returned;
  const months = ret ? region.months.filter((m) => m.ym >= ret.from && m.ym <= ret.to) : [];
  const cells = months.map((m) => cell(m, series, region.mode));
  const values = cells.map((c) => c.v).filter((v): v is number => v !== null);
  const explicit = p.from !== undefined || p.to !== undefined;
  return {
    ...rest,
    name: safeText(region.name),
    series,
    series_label: SERIES_LABEL[series],
    anomaly_series: anomalySeries,
    max_value: values.length ? Math.max(...values) : null,
    anomaly_months: months.filter((m) => m.anom).map((m) => m.ym),
    backcast_months: series === "harm" ? months.filter((m) => m.src !== "observed").length : 0,
    totals: records,
    view_url: viewUrl(country, region.id, explicit && ret ? ret.from : null, explicit && ret ? ret.to : null, series),
    months: cells,
  };
}

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/**
 * The text block of a show_calendar result keeps the caveat header lines but drops the per-month cells from its
 * JSON (last line): the widget reads structuredContent, the model gets totals, anomaly months and links.
 */
export function withoutCells<T extends ToolResult>(r: T): T {
  if (r.isError || !r.content.length) return r;
  const text = r.content[0].text;
  const cut = text.lastIndexOf("\n");
  const body = JSON.parse(text.slice(cut + 1)) as Record<string, unknown>;
  const n = Array.isArray(body.months) ? body.months.length : 0;
  delete body.months;
  body.months_in_widget = n;
  body.monthly_values = "Shown in the calendar widget. For monthly numbers call get_region_series (max 120 months per call) or read csv_url.";
  const head = cut >= 0 ? text.slice(0, cut + 1) : "";
  return { ...r, content: [{ type: "text", text: head + JSON.stringify(body) }, ...r.content.slice(1)] };
}

export interface CalendarDeps {
  ok: (raw: object, mode: "full" | "codes") => Promise<ToolResult>;
  fail: (e: unknown) => ToolResult;
  loadRegion: (id: string) => Promise<RegionFile>;
  period: () => Promise<Period>;
  regionId: z.ZodString;
  ym: z.ZodString;
  caveatMode: z.ZodDefault<z.ZodEnum<{ full: "full"; codes: "codes" }>>;
  annotations: { readOnlyHint: true; openWorldHint: false; idempotentHint: true };
}

export function registerCalendar(server: McpServer, d: CalendarDeps) {
  server.registerResource(
    "calendar_widget",
    CALENDAR_URI,
    {
      title: "Burning calendar widget",
      description: "MCP Apps view for show_calendar: years x months heat strip of one region. Self-contained HTML, no external hosts.",
      mimeType: RESOURCE_MIME_TYPE,
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: CALENDAR_HTML, _meta: { ui: { prefersBorder: true } } }],
    }),
  );

  server.registerTool(
    "show_calendar",
    {
      title: "Show burning calendar",
      description:
        "Show the burning calendar of one region as an interactive heat strip in the chat (years x months; MCP Apps widget). " +
        "Harmonized regions show harm (VIIRS-equivalent), relative regions raw MODIS. Back-cast months (before 2012) are hatched, " +
        "anomalies (above baseline_p90) outlined. Default range: all of 2000-11 to 2025-12. Hosts without widgets get calendar-year " +
        "totals, anomaly months, caveats and a view_url; for monthly numbers use get_region_series. Pass on the caveats.",
      inputSchema: z.object({
        caveats: d.caveatMode,
        region_id: d.regionId,
        from: d.ym.optional(),
        to: d.ym.optional(),
        series: z.enum(["harm", "modis", "viirs"]).optional()
          .describe("Series to colour by. Default: harm for harmonized regions, modis for relative ones (they have no harm)."),
      }),
      annotations: d.annotations,
      _meta: { ui: { resourceUri: CALENDAR_URI }, [LEGACY_RESOURCE_URI_KEY]: CALENDAR_URI },
    },
    async ({ region_id, from, to, series, caveats }) => {
      try {
        return withoutCells(await d.ok(calendarData(await d.loadRegion(region_id), { from, to, series }, await d.period()), caveats));
      } catch (e) {
        return d.fail(e);
      }
    },
  );
}
