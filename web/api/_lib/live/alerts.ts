// get_fire_alerts: wildfire events from GDACS and Copernicus EMS rapid mapping activations.
import type { CountryCode } from "../../../src/lib/contract.ts";
import {
  addDays, cleanText, fetchUpstream, type LiveCaveat, round, type SourceInfo, today, UNTRUSTED, upstreamError,
} from "./core.ts";
import { COUNTRY_NAME, regionOfPoint } from "./regions.ts";

export const GDACS: SourceInfo = {
  name: "GDACS, Global Disaster Alert and Coordination System (wildfire events, GWIS input)",
  url: "https://www.gdacs.org/",
  licence: "Free access; GDACS asks for the source credit and says alerts are indicative and need confirmation before decisions (gdacs.org terms of use).",
  attribution: "Source: Global Disaster Alert and Coordination System, GDACS",
};

export const CEMS: SourceInfo = {
  name: "Copernicus Emergency Management Service, Rapid Mapping activations",
  url: "https://mapping.emergency.copernicus.eu/activations/",
  licence: "Copernicus data policy: free, full and open access (UNVERIFIED for the dashboard API).",
  attribution: "© European Union, Copernicus Emergency Management Service",
};

export interface AlertItem {
  source: "GDACS" | "CEMS";
  id: string;
  title: string;
  date: string;
  date_end?: string;
  url: string;
  severity: { level: string | null; value: number | null; unit: string | null; text: string | null };
  lat: number | null;
  lon: number | null;
  country: "GR" | "AR";
  matched_region: { id: string; name: string } | null;
}

const TTL = 10 * 60_000;

type GdacsFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    eventid?: number; episodeid?: number; name?: string; htmldescription?: string; fromdate?: string; todate?: string;
    alertlevel?: string; iso3?: string; country?: string; url?: { report?: string };
    severitydata?: { severity?: number; severitytext?: string; severityunit?: string };
  };
};

/** GDACS wildfire events for one country. country takes the English name; ISO3 does not filter reliably. */
export function gdacsUrl(country: CountryCode, from: string, to: string): URL {
  const u = new URL("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH");
  u.searchParams.set("eventlist", "WF");
  u.searchParams.set("country", COUNTRY_NAME[country]);
  u.searchParams.set("fromDate", from);
  u.searchParams.set("toDate", to);
  u.searchParams.set("alertlevel", "green;orange;red"); // default returns orange and red only
  return u;
}

const ISO3: Record<CountryCode, string> = { gr: "GRC", ar: "ARG" };

export function parseGdacs(json: unknown, country: CountryCode): Omit<AlertItem, "matched_region">[] {
  const features = (json as { features?: GdacsFeature[] } | null)?.features ?? [];
  return features
    .filter((f) => f.properties?.iso3 === ISO3[country])
    .map((f) => {
      const p = f.properties!;
      const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
      const report = typeof p.url?.report === "string" && p.url.report.startsWith("https://www.gdacs.org/") ? p.url.report
        : `https://www.gdacs.org/report.aspx?eventtype=WF&eventid=${Number(p.eventid)}`;
      return {
        source: "GDACS" as const,
        id: `WF${Number(p.eventid)}-${Number(p.episodeid ?? 1)}`,
        title: cleanText(p.htmldescription || p.name, 160),
        date: cleanText(p.fromdate, 19).slice(0, 10),
        date_end: cleanText(p.todate, 19).slice(0, 10) || undefined,
        url: report,
        severity: {
          level: cleanText(p.alertlevel, 10) || null,
          value: round(p.severitydata?.severity ?? null, 0),
          unit: cleanText(p.severitydata?.severityunit, 10) || null,
          text: cleanText(p.severitydata?.severitytext, 120) || null,
        },
        lat: round(lat, 4), lon: round(lon, 4),
        country: country.toUpperCase() as "GR" | "AR",
      };
    });
}

export const CEMS_URL = (() => {
  const u = new URL("https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/");
  u.searchParams.set("category", "Wildfire");
  u.searchParams.set("limit", "60"); // newest first; ~130 wildfire activations since 2023
  return u;
})();

type CemsActivation = { code?: string; countries?: string[]; eventTime?: string; activationTime?: string; name?: string;
                        centroid?: string; category?: string; closed?: boolean };

export function parseCems(json: unknown, country: CountryCode, from: string): Omit<AlertItem, "matched_region">[] {
  const rows = (json as { results?: CemsActivation[] } | null)?.results ?? [];
  return rows
    .filter((a) => a.category === "Wildfire" && a.countries?.includes(COUNTRY_NAME[country]))
    .filter((a) => (a.eventTime ?? a.activationTime ?? "").slice(0, 10) >= from)
    .map((a) => {
      const m = /POINT \((-?[\d.]+) (-?[\d.]+)\)/.exec(a.centroid ?? "");
      const code = /^EMSR\d{1,5}$/.test(a.code ?? "") ? a.code! : "unknown";
      return {
        source: "CEMS" as const,
        id: code,
        title: cleanText(a.name, 160),
        date: cleanText(a.eventTime ?? a.activationTime, 19).slice(0, 10),
        url: `https://mapping.emergency.copernicus.eu/activations/${code}`,
        severity: { level: a.closed ? "closed" : "open", value: null, unit: null, text: "Rapid mapping activation (satellite damage and extent maps)" },
        lat: m ? round(Number(m[2]), 4) : null,
        lon: m ? round(Number(m[1]), 4) : null,
        country: country.toUpperCase() as "GR" | "AR",
      };
    });
}

export async function fireAlerts(p: { countries: CountryCode[]; region_id?: string; days: number }) {
  const to = today();
  const from = addDays(to, -(p.days - 1));
  const caveats: LiveCaveat[] = [UNTRUSTED];
  const items: AlertItem[] = [];
  const tasks: Promise<void>[] = [];
  for (const c of p.countries) {
    tasks.push(fetchUpstream(gdacsUrl(c, from, to), "json", TTL)
      .then((j) => { items.push(...parseGdacs(j, c).map((x) => ({ ...x, matched_region: null }))); })
      .catch((e) => { caveats.push(upstreamError("GDACS", e)); }));
  }
  tasks.push(fetchUpstream(CEMS_URL, "json", TTL)
    .then((j) => { for (const c of p.countries) items.push(...parseCems(j, c, from).map((x) => ({ ...x, matched_region: null }))); })
    .catch((e) => { caveats.push(upstreamError("Copernicus EMS", e)); }));
  await Promise.all(tasks);

  for (const it of items) {
    if (it.lat !== null && it.lon !== null) it.matched_region = await regionOfPoint(it.country.toLowerCase() as CountryCode, it.lat, it.lon);
  }
  const isCountry = !p.region_id || p.region_id === "GR" || p.region_id === "AR";
  const kept = isCountry ? items : items.filter((it) => it.matched_region?.id === p.region_id);
  kept.sort((a, b) => b.date.localeCompare(a.date));
  caveats.push({
    code: "provisional",
    message: "GDACS wildfire events come from GWIS satellite burnt-area mapping: areas and alert levels are automatic estimates and change as the fire develops. Events and activations are points (centroids); matched_region is the region holding that point.",
  });
  return {
    window: { from, to, days: p.days },
    countries: p.countries.map((c) => c.toUpperCase()),
    region_id: p.region_id ?? null,
    count: kept.length,
    outside_region: isCountry ? 0 : items.length - kept.length,
    items: kept.slice(0, 50),
    not_included: "ReliefWeb reports (needs an approved appname) and news media (terms vary) are not queried.",
    caveats,
  };
}
