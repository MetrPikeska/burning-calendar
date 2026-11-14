// investigate_month: one call that sets a calendar month next to its weather and, for recent months, the live
// picture (FIRMS NRT, GDACS / Copernicus EMS alerts), with links to the map and the data behind it.
// History never depends on a third party: every live part fails on its own into an upstream_error caveat.
import { type Caveat, monthContext } from "../tools.ts";
import { CEMS, fireAlerts, GDACS } from "./alerts.ts";
import { addDays, type LiveCaveat, type SourceInfo, today, upstreamError } from "./core.ts";
import { FIRMS, recentDetections } from "./firms.ts";
import { type LiveRegion, loadIndex, loadRegionFile } from "./regions.ts";
import { fireWeather, OPEN_METEO } from "./weather.ts";

export const ASSOCIATION: LiveCaveat = {
  code: "association_not_cause",
  message: "Weather is context for the month, not its cause: hot, dry and windy days make fires easier to start and spread, but ignitions (agricultural burning, accidents, arson, lightning) are not in these data.",
};

/** Months whose live picture is still meaningful: the current and the previous calendar month. */
export function isRecent(ym: string, now = today()): boolean {
  return ym >= addDays(`${now.slice(0, 7)}-01`, -1).slice(0, 7) && ym <= now.slice(0, 7);
}

/** First and last day of the month's weather window, clipped to today; null when there is no reanalysis for it. */
export function weatherWindow(ym: string, now = today()): { from: string; to: string } | null {
  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  if (from > now || from < "1940-01-01") return null;
  return { from, to: last < now ? last : now };
}

/** Same-code caveats joined into one, so the envelope (which keeps one caveat per code) loses nothing.
 *  Calendar caveat codes pass through as they are; the envelope only reads code and message. */
function mergeCaveats(cs: (Caveat | LiveCaveat)[]): { code: string; message: string }[] {
  const by = new Map<string, string[]>();
  for (const c of cs) {
    const list = by.get(c.code) ?? [];
    if (!list.includes(c.message)) list.push(c.message);
    by.set(c.code, list);
  }
  return [...by.entries()].map(([code, ms]) => ({ code, message: ms.join(" ") }));
}

type Part<T> = { body: T; caveats: LiveCaveat[]; sources: SourceInfo[] };

/** Runs one live part; a throw becomes an upstream_error caveat and a null body. */
async function part<T>(label: string, run: () => Promise<Part<T>>): Promise<Part<T | null>> {
  try {
    return await run();
  } catch (e) {
    return { body: null, caveats: [upstreamError(label, e)], sources: [] };
  }
}

export async function investigateMonth(r: LiveRegion, ym: string, env: NodeJS.ProcessEnv = process.env) {
  const [file, index] = await Promise.all([loadRegionFile(r.country, r.id), loadIndex(r.country)]);
  const history = monthContext(file, ym, index.period);
  const now = today();
  const ww = weatherWindow(ym, now);

  const [weather, detections, alerts] = await Promise.all([
    ww
      ? part("Open-Meteo", async () => {
          const w = await fireWeather({ ...r.point, from: ww.from, to: ww.to });
          return {
            body: { point: w.point, grid_cell: w.grid_cell, window: w.window, summary: w.summary, units: w.units,
                    days_returned: w.days.length, daily_values: "Use get_fire_weather with this window for the daily values." },
            caveats: [...w.caveats, ASSOCIATION], sources: [OPEN_METEO],
          };
        })
      : Promise.resolve({ body: { skipped: `No reanalysis for ${ym}: Open-Meteo covers 1940 to today.` }, caveats: [], sources: [] }),
    isRecent(ym, now)
      ? part("NASA FIRMS", async () => {
          const { caveats, ...d } = await recentDetections(r, 7, env);
          return {
            body: { configured: d.configured, window: d.window, totals: d.totals,
                    ...("calendar_context" in d ? { calendar_context: d.calendar_context, sources_failed: d.sources_failed } : {}) },
            caveats, sources: [FIRMS],
          };
        })
      : null,
    isRecent(ym, now)
      ? part("GDACS / Copernicus EMS", async () => {
          const { caveats, ...a } = await fireAlerts({ countries: [r.country], region_id: r.id, days: 14 });
          return { body: { window: a.window, count: a.count, items: a.items.slice(0, 10) }, caveats, sources: [GDACS, CEMS] };
        })
      : null,
  ]);
  // Fixed order: history, weather, detections, alerts, whatever finished first.
  const parts = [weather, detections, alerts].filter((p): p is NonNullable<typeof p> => p !== null);
  return {
    body: {
      region: { id: r.id, name: r.name, country: r.country.toUpperCase(), level: r.level, point: r.point },
      ym,
      history,
      weather: weather.body,
      now: detections && alerts
        ? { recent_detections: detections.body, alerts: alerts.body }
        : { skipped: `${ym} is not the current or previous month; live detections and alerts only cover recent days.` },
      evidence: {
        map: history.view_url, monthly_json: history.data_url, monthly_csv: history.csv_url,
        detections_csv: history.detections_csv_url ?? null,
        ...("detections_note" in history ? { detections_note: history.detections_note } : {}),
        method: "get_methodology and get_validation explain the harmonization and its errors.",
      },
    },
    caveats: mergeCaveats([...history.caveats, ...parts.flatMap((p) => p.caveats)]),
    sources: parts.flatMap((p) => p.sources),
  };
}
