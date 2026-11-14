// investigate_month: one call that sets a calendar month next to its weather and, for recent months, the live
// picture (FIRMS NRT, GDACS / Copernicus EMS alerts), with links to the map and the data behind it.
// History never depends on a third party: every live part fails on its own into an upstream_error caveat.
import { CEMS, fireAlerts, GDACS } from "./live/alerts.ts";
import { addDays, type LiveCaveat, type SourceInfo, today, upstreamError } from "./live/core.ts";
import { FIRMS, recentDetections } from "./live/firms.ts";
import { loadIndex, loadRegionFile, resolveRegion } from "./live/regions.ts";
import { fireWeather, OPEN_METEO } from "./live/weather.ts";
import { type Caveat, monthContext } from "./tools.ts";

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

/** Same-code caveats joined into one, so the envelope (which keeps one caveat per code) loses nothing. */
function mergeCaveats(cs: (Caveat | LiveCaveat)[]): LiveCaveat[] {
  const by = new Map<string, string[]>();
  for (const c of cs) {
    const list = by.get(c.code) ?? [];
    if (!list.includes(c.message)) list.push(c.message);
    by.set(c.code, list);
  }
  return [...by.entries()].map(([code, ms]) => ({ code: code as LiveCaveat["code"], message: ms.join(" ") }));
}

export async function investigateMonth(regionId: string, ym: string, env: NodeJS.ProcessEnv = process.env) {
  const r = await resolveRegion(regionId);
  const [file, index] = await Promise.all([loadRegionFile(r.country, r.id), loadIndex(r.country)]);
  const history = monthContext(file, ym, index.period);
  const now = today();
  const recent = isRecent(ym, now);
  const ww = weatherWindow(ym, now);
  const sources: SourceInfo[] = [];
  const caveats: (Caveat | LiveCaveat)[] = [...history.caveats];

  const weatherPart = ww
    ? fireWeather({ ...r.point, from: ww.from, to: ww.to }).then((w) => {
        sources.push(OPEN_METEO);
        caveats.push(...w.caveats, ASSOCIATION);
        return { point: w.point, grid_cell: w.grid_cell, window: w.window, summary: w.summary, units: w.units,
                 days_returned: w.days.length,
                 daily_values: "Use get_fire_weather with this window for the daily values." };
      }).catch((e) => { caveats.push(upstreamError("Open-Meteo", e)); return null; })
    : Promise.resolve({ skipped: `No reanalysis for ${ym}: Open-Meteo covers 1940 to today.` });

  const nowPart = recent
    ? Promise.all([
        recentDetections(r, 7, env).then((d) => {
          sources.push(FIRMS);
          const { caveats: c, ...body } = d;
          caveats.push(...c);
          return { configured: body.configured, window: body.window, totals: body.totals,
                   ...("calendar_context" in body ? { calendar_context: body.calendar_context, sources_failed: body.sources_failed } : {}) };
        }).catch((e) => { caveats.push(upstreamError("NASA FIRMS", e)); return null; }),
        fireAlerts({ countries: [r.country], region_id: r.id, days: 14 }).then((a) => {
          sources.push(GDACS, CEMS);
          const { caveats: c, ...body } = a;
          caveats.push(...c);
          return { window: body.window, count: body.count, items: body.items.slice(0, 10) };
        }).catch((e) => { caveats.push(upstreamError("GDACS / Copernicus EMS", e)); return null; }),
      ]).then(([detections, alerts]) => ({ recent_detections: detections, alerts }))
    : Promise.resolve(null);

  const [weather, nowBlock] = await Promise.all([weatherPart, nowPart]);
  return {
    body: {
      region: { id: r.id, name: r.name, country: r.country.toUpperCase(), level: r.level, point: r.point },
      ym,
      history,
      weather,
      now: nowBlock ?? { skipped: `${ym} is not the current or previous month; live detections and alerts only cover recent days.` },
      evidence: {
        map: history.view_url, monthly_json: history.data_url, monthly_csv: history.csv_url,
        detections_csv: history.detections_csv_url ?? null,
        ...("detections_note" in history ? { detections_note: history.detections_note } : {}),
        method: "get_methodology and get_validation explain the harmonization and its errors.",
      },
    },
    caveats: mergeCaveats(caveats),
    sources,
  };
}
