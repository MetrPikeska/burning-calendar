// MCP endpoint (Streamable HTTP, stateless, read-only, no auth). Tool logic lives in api/_lib/tools.ts.
// Data comes from public/data/** bundled via vercel.json functions."api/mcp.ts".includeFiles.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import type { CountryCode, IndexFile, RegionFile } from "../src/lib/contract.ts";
import type { RegionCollection } from "../src/lib/geo.ts";
import {
  aggregate,
  anomaliesFor,
  compactCaveats,
  type CountryValidation,
  validationFor,
  type Caveat,
  COMPARE_METRICS,
  compareRegions,
  countriesIn,
  countryOf,
  locate,
  METHODOLOGY,
  MONTH_FIELDS,
  RANK_METRICS,
  rankRegions,
  type Period,
  PUBLIC_URL,
  regionSeries,
  regionSummary,
  searchRegions,
  seasonCalendar,
  withCoverage,
} from "./_lib/tools.ts";

// Vercel bundles includeFiles at their repo-relative path: /var/task/public/... for a CLI deploy
// from web/, /var/task/web/public/... for a Git deploy with root directory web/. Locally cwd is web/.
const DATA_DIR =
  [join(process.cwd(), "public", "data", "v1"), join(process.cwd(), "web", "public", "data", "v1")].find((d) =>
    existsSync(join(d, "gr", "index.json")),
  ) ?? join(process.cwd(), "public", "data", "v1");

const cache = new Map<string, Promise<unknown>>();
function loadJson<T>(rel: string): Promise<T> {
  if (!cache.has(rel)) cache.set(rel, readFile(join(DATA_DIR, rel), "utf8").then((s) => JSON.parse(s)));
  return cache.get(rel) as Promise<T>;
}
const loadIndex = (c: CountryCode) => loadJson<IndexFile>(`${c}/index.json`);
const loadGeo = (c: CountryCode) => loadJson<RegionCollection>(`${c}/regions.geojson`);

async function loadRegion(id: string): Promise<RegionFile> {
  const country = countryOf(id);
  if (!country || !(await loadIndex(country)).regions.some((r) => r.id === id)) {
    throw new Error(`Unknown region_id "${id}". Use search_regions to list ids (Greece: GR, EL30..EL65; Argentina: AR, 02..94).`);
  }
  return loadJson<RegionFile>(`${country}/regions/${id}.json`);
}

/** Coverage from index.json `period` (both countries share it). */
const period = async (): Promise<Period> => (await loadIndex("gr")).period;

type Provenance = { firms?: { downloaded?: string[] } };

/** Short provenance for every result; the full block is `source` in the index.json of each country the result covers. */
async function source(countries: CountryCode[]) {
  const ix = await Promise.all(countries.map((c) => loadIndex(c)));
  const dl = ix.flatMap((i) => (i as IndexFile & { source?: Provenance }).source?.firms?.downloaded ?? []);
  return {
    method_version: ix[0].method_version,
    firms: "NASA FIRMS standard processing, MODIS C6.1 + VIIRS S-NPP 375 m",
    firms_downloaded: [...new Set(dl)].sort(),
    details: countries.map((c) => `${PUBLIC_URL}data/v1/${c}/index.json#source`),
  };
}

/** Adds coverage and source, then caveats first in the text block and the full JSON (TextContent mirrors structuredContent). */
async function ok(raw: object, mode: "full" | "codes" = "full") {
  const full = { ...withCoverage(raw, await period()), source: await source(countriesIn(raw)) };
  if (mode === "codes") {
    const result = compactCaveats(full);
    const text = `CAVEATS (codes; get_methodology topic 'caveats' explains them): ${result.caveat_codes.join(", ")}\n${JSON.stringify(result)}`;
    return { content: [{ type: "text" as const, text }], structuredContent: result };
  }
  // Caveat texts go once into the header lines; the JSON in the text block lists only their codes.
  // structuredContent keeps the full caveats.
  const lines = full.caveats.map((c: Caveat) => `CAVEAT ${c.code}: ${c.message}`);
  const { caveats, ...rest } = full;
  const body = { ...rest, caveat_codes: caveats.map((c: Caveat) => c.code) };
  return {
    content: [{ type: "text" as const, text: [...lines, JSON.stringify(body)].join("\n") }],
    structuredContent: full,
  };
}

function fail(e: unknown) {
  return { content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }], isError: true };
}

const RO = { readOnlyHint: true, openWorldHint: false, idempotentHint: true } as const;
const regionId = z.string().regex(/^(GR|AR|EL\d\d|\d\d)$/).describe("Region id: GR, AR, NUTS2 code like EL52, or IGN province code like 30");
const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe("Month as YYYY-MM, 2000-11 to 2025-12");
const caveatMode = z.enum(["full", "codes"]).default("full")
  .describe("full: caveat texts (use on the first call); codes: only caveat codes, to save tokens on later calls");
const year = z.number().int().min(2000).max(2100).describe("Calendar year; data cover 2000-11 to 2025-12");

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_regions",
      {
        title: "Search regions",
        description:
          "List regions of the burning calendar (Greece: country GR and 13 NUTS2 regions; Argentina: country AR and 24 provinces) " +
          "with mode, season climatology (months 1-12) and a view_url to the interactive map. Regions in mode 'relative' have no harmonized counts.",
        inputSchema: z.object({ caveats: caveatMode,
          country: z.enum(["GR", "AR"]).optional(),
          level: z.enum(["country", "nuts2", "province"]).optional(),
          query: z.string().max(64).optional().describe("Part of the region name, or an exact id"),
          limit: z.number().int().min(1).max(50).default(50),
        }),
        annotations: RO,
      },
      async (p) => {
        try {
          return await ok(searchRegions([await loadIndex("gr"), await loadIndex("ar")], p), p.caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "get_region_series",
      {
        title: "Monthly fire detection series",
        description:
          "Monthly (max 120 records) or calendar-year detection counts for one region: modis, viirs, harm (VIIRS-equivalent), " +
          "harm_lo..harm_hi for modelled months before 2012, anomaly flags. Null fields are omitted; `fields` picks record keys. " +
          "Month mode also returns calendar-year totals on the same series (harm, or modis in relative mode), partial years marked. " +
          "Always pass on the caveats; quote back-cast months with their range. Returns view_url (map), data_url (JSON) and csv_url (full series).",
        inputSchema: z.object({ caveats: caveatMode,
          region_id: regionId,
          from: ym,
          to: ym,
          aggregate: z.enum(["month", "year"]).default("month"),
          fields: z.array(z.enum(MONTH_FIELDS)).max(MONTH_FIELDS.length).optional()
            .describe("Month record keys to return (ym is always included). Default: the series of the region's mode, src, anom, outage. days_viirs / days_modis: days of the month with at least one detection."),
        }),
        annotations: RO,
      },
      async ({ region_id, from, to, aggregate, fields, caveats }) => {
        try {
          return await ok(regionSeries(await loadRegion(region_id), { from, to, aggregate, fields }, await period()), caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "get_season_calendar",
      {
        title: "Fire season calendar",
        description:
          "Fire season of one region: climatological peak month, onset, end, season length, season start month, bimodal flag, " +
          "and per season year the same metrics plus the total. Give a year to get one season year only.",
        inputSchema: z.object({ caveats: caveatMode, region_id: regionId, year: year.optional() }),
        annotations: RO,
      },
      async ({ region_id, year: y, caveats }) => {
        try {
          return await ok(seasonCalendar(await loadRegion(region_id), y, await period()), caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "get_anomalies",
      {
        title: "Monthly anomalies vs the preceding 10 years",
        description:
          "For each month of a calendar year: value, percentile rank among the same month of the preceding 10 years, " +
          "baseline median and 90th percentile, ratio to the median, and whether it is flagged as an anomaly.",
        inputSchema: z.object({ caveats: caveatMode, region_id: regionId, year }),
        annotations: RO,
      },
      async ({ region_id, year: y, caveats }) => {
        try {
          return await ok(anomaliesFor(await loadRegion(region_id), y, await period()), caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "compare_regions",
      {
        title: "Compare regions",
        description:
          "Compare 2 to 10 regions on one metric. Count metrics (annual_mean, density_per_1000km2, season_total) are ranked only when all regions are harmonized; " +
          "otherwise ranking_allowed is false and you must not rank them. season_total needs a year.",
        inputSchema: z.object({ caveats: caveatMode,
          region_ids: z.array(regionId).min(2).max(10),
          metric: z.enum(COMPARE_METRICS),
          year: year.optional(),
        }),
        annotations: RO,
      },
      async ({ region_ids, metric, year: y, caveats }) => {
        try {
          const items = await Promise.all(
            [...new Set(region_ids)].map(async (id) => {
              const region = await loadRegion(id);
              const country = countryOf(id)!;
              const entry = (await loadIndex(country)).regions.find((r) => r.id === id)!;
              return { country, entry, region };
            }),
          );
          return await ok(compareRegions(items, metric, y), caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "aggregate",
      {
        title: "Totals over a period",
        description:
          "Sum detections over a period for 1 to 40 regions: total per region, overall total and the top months of the sum. " +
          "Uses harm (VIIRS-equivalent) when all regions are harmonized, otherwise raw MODIS for all with a caveat. " +
          "Do not mix a country (GR, AR) with its own regions.",
        inputSchema: z.object({ caveats: caveatMode,
          region_ids: z.array(regionId).min(1).max(40),
          from: ym,
          to: ym,
          top: z.number().int().min(1).max(24).default(5),
        }),
        annotations: RO,
      },
      async ({ region_ids, from, to, top, caveats }) => {
        try {
          const regions = await Promise.all([...new Set(region_ids)].map((id) => loadRegion(id)));
          return await ok(aggregate(regions, { from, to, top }, await period()), caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "rank_regions",
      {
        title: "Rank regions",
        description:
          "Rank all regions (or one country / level) by a metric, e.g. 'where were the most fires'. Prefer density_per_1000km2 " +
          "(detections per 1000 km2 per year) over annual_mean, which favours large regions. Count metrics rank harmonized regions only; " +
          "relative-mode regions are returned apart in excluded_relative. season_total needs a year. Country-level rows are left out unless level is 'country'.",
        inputSchema: z.object({ caveats: caveatMode,
          metric: z.enum(RANK_METRICS),
          country: z.enum(["GR", "AR"]).optional(),
          level: z.enum(["country", "nuts2", "province"]).optional(),
          year: year.optional(),
          top: z.number().int().min(1).max(50).default(10),
          order: z.enum(["desc", "asc"]).default("desc"),
        }),
        annotations: RO,
      },
      async ({ metric, country, level, year: y, top, order, caveats }) => {
        try {
          const items = [];
          for (const c of ["gr", "ar"] as const) {
            if (country && country.toLowerCase() !== c) continue;
            for (const entry of (await loadIndex(c)).regions) {
              if (level ? entry.level !== level : entry.level === "country") continue;
              items.push({ country: c, entry, region: metric === "season_total" ? await loadRegion(entry.id) : undefined });
            }
          }
          return await ok(rankRegions(items, metric, { year: y, top, order }), caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "find_region_at",
      {
        title: "Find region at a point",
        description:
          "Region (Greek NUTS2 or Argentine province) containing a latitude/longitude, with its season climatology, annual mean, " +
          "last 3 season years, view_url and data_url. Outside both countries: found false, plus the nearest region within 5 km if any.",
        inputSchema: z.object({ caveats: caveatMode, lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
        annotations: RO,
      },
      async ({ lat, lon, caveats }) => {
        try {
          const m = locate({ gr: await loadGeo("gr"), ar: await loadGeo("ar") }, lat, lon);
          const hit = m.found ? m : m.nearest;
          if (!hit) return await ok({ found: false, nearest: null }, caveats);
          const entry = (await loadIndex(hit.country)).regions.find((r) => r.id === hit.id);
          if (!entry) return await ok({ found: false, nearest: null }, caveats);
          const summary = regionSummary(hit.country, entry, await loadRegion(hit.id));
          return await ok(m.found ? { found: true, ...summary }
                                  : { found: false, nearest: { distance_km: m.nearest!.distance_km, ...summary } }, caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "get_validation",
      {
        title: "Validation of the harmonization",
        description:
          "How well the back-cast reproduces VIIRS for one region: leave-one-year-out and 2020-2025 time-split errors per year, " +
          "monthly scores, peak-month hit rates vs raw MODIS, fit-window gap, VIIRS/MODIS ratio trend, uncertainty band and the mode reasons. " +
          "For GR or AR also a table of all regions plus filter and assignment counts.",
        inputSchema: z.object({ region_id: regionId, caveats: caveatMode }),
        annotations: RO,
      },
      async ({ region_id, caveats }) => {
        try {
          const region = await loadRegion(region_id);
          const country = countryOf(region_id)!;
          const extra = region.level === "country"
            ? { validation: await loadJson<CountryValidation>(`${country}/validation.json`), index: await loadIndex(country) }
            : undefined;
          return await ok(validationFor(region, extra), caveats);
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.registerTool(
      "get_methodology",
      {
        title: "Methodology",
        description: "How the data were made: overview, harmonization, validation, modes, anomalies, calendar, caveats (meaning of each caveat code), limits.",
        inputSchema: z.object({
          topic: z.enum(["overview", "harmonization", "validation", "modes", "anomalies", "calendar", "caveats", "limits"]).default("overview"),
        }),
        annotations: RO,
      },
      async ({ topic }) => await ok({ topic, text: METHODOLOGY[topic] }),
    );
  },
  { serverInfo: { name: "burning-calendar", version: "0.5.0" } },
);

export { handler as GET, handler as POST };
