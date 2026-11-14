// GET /api/recent?region=EL52: FIRMS near real-time detections of the last 3 days for the web panel's
// "Now" line. Same code and key handling as the MCP tool get_recent_detections (web/api/_lib/live/firms.ts);
// the MAP_KEY stays on the server. Read-only, no state; the CDN caches a good answer for 15 min.
import { recentDetections } from "./_lib/live/firms.ts";
import { resolveRegion } from "./_lib/live/regions.ts";

export const REGION_ID = /^(GR|AR|EL\d\d|\d\d)$/;
export const RECENT_DAYS = 3;

/** What the web needs from recentDetections: totals, the calendar context and the caveat codes. */
export interface RecentBody {
  region_id: string;
  window: { from: string; to: string; days: number };
  configured: boolean;
  total: number;
  totals: Record<string, number>;
  sources_failed?: string[];
  calendar_context: { month: number; years: string; median_per_day: number | null; nrt_viirs_noaa20_per_day: number | null; ratio_to_median_per_day: number | null } | null;
  fetched_at: string;
  caveats: string[];
}

function json(body: unknown, status: number, cache: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, "access-control-allow-origin": "*" },
  });
}

export async function recentFor(id: string, env: NodeJS.ProcessEnv = process.env): Promise<RecentBody> {
  const r = await resolveRegion(id);
  const d = await recentDetections(r, RECENT_DAYS, env);
  const totals = (d.totals ?? {}) as Record<string, number>;
  const ctx = "calendar_context" in d ? d.calendar_context : null;
  return {
    region_id: d.region_id,
    window: d.window,
    configured: d.configured,
    total: Object.values(totals).reduce((a, b) => a + b, 0),
    totals,
    ...("sources_failed" in d && d.sources_failed ? { sources_failed: d.sources_failed } : {}),
    calendar_context: ctx
      ? { month: ctx.month, years: ctx.years, median_per_day: ctx.median_per_day, nrt_viirs_noaa20_per_day: ctx.nrt_viirs_noaa20_per_day, ratio_to_median_per_day: ctx.ratio_to_median_per_day }
      : null,
    fetched_at: new Date().toISOString(),
    caveats: d.caveats.map((c) => c.code),
  };
}

export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("region") ?? "";
  if (!REGION_ID.test(id)) {
    return json({ error: "region must be GR, AR, a NUTS2 code like EL52 or an IGN province code like 30" }, 400, "no-store");
  }
  let body: RecentBody;
  try {
    body = await recentFor(id);
  } catch {
    return json({ error: `unknown region ${id}` }, 404, "no-store");
  }
  // Cache only complete answers, so a missing key or an upstream hiccup is not pinned for 15 min.
  const good = body.configured && !body.sources_failed;
  return json(body, 200, good ? "public, max-age=300, s-maxage=900, stale-while-revalidate=300" : "no-store");
}
