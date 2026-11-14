import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CEMS_URL, fireAlerts, gdacsUrl, parseCems, parseGdacs } from "../api/_lib/live/alerts.ts";
import { clearLiveCache } from "../api/_lib/live/core.ts";

const gdacs = {
  type: "FeatureCollection",
  features: [
    {
      geometry: { type: "Point", coordinates: [23.7, 38.5] },
      properties: {
        eventid: 1001, episodeid: 2, name: "Forest fires in Greece", htmldescription: "Orange Forest fires in Greece\u0007 <i>now</i>",
        fromdate: "2026-11-10T00:00:00", todate: "2026-11-12T00:00:00", alertlevel: "Orange", iso3: "GRC",
        url: { report: "https://www.gdacs.org/report.aspx?eventid=1001&episodeid=2&eventtype=WF" },
        severitydata: { severity: 4162, severitytext: "Orange impact for forestfire in 4162 ha", severityunit: "ha" },
      },
    },
    { geometry: { coordinates: [20, 41] }, properties: { eventid: 9, iso3: "ALB", name: "Albania" } },
  ],
};
const cems = {
  results: [
    { code: "EMSR999", countries: ["Greece"], eventTime: "2026-11-11T10:00:00", name: "Wildfire in Evia, Greece",
      centroid: "POINT (23.69 38.50)", category: "Wildfire", closed: false },
    { code: "EMSR998", countries: ["Greece"], eventTime: "2026-11-11T10:00:00", name: "Flood", centroid: "POINT (22 39)", category: "Flood" },
    { code: "EMSR700", countries: ["Greece"], eventTime: "2023-08-21T08:11:00", name: "Old fire", centroid: "POINT (23.7 38.4)", category: "Wildfire" },
    { code: "EMSR997", countries: ["Argentina"], eventTime: "2026-11-12T00:00:00", name: "Wildfire in Corrientes", centroid: "POINT (-57.8 -28.5)", category: "Wildfire" },
  ],
};

const fetchMock = vi.fn();
beforeEach(() => {
  clearLiveCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GDACS", () => {
  it("builds the event list URL with the country name and all alert levels", () => {
    const u = gdacsUrl("gr", "2026-11-01", "2026-11-14");
    expect(u.hostname).toBe("www.gdacs.org");
    expect(u.searchParams.get("country")).toBe("Greece");
    expect(u.searchParams.get("alertlevel")).toBe("green;orange;red");
  });

  it("keeps only the country's events and cleans third-party text", () => {
    const items = parseGdacs(gdacs, "gr");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "GDACS", id: "WF1001-2", title: "Orange Forest fires in Greece now", date: "2026-11-10", date_end: "2026-11-12",
      severity: { level: "Orange", value: 4162, unit: "ha" }, lat: 38.5, lon: 23.7, country: "GR",
    });
    expect(parseGdacs(null, "gr")).toEqual([]);
  });
});

describe("Copernicus EMS", () => {
  it("requests wildfire activations and filters by country and date", () => {
    expect(CEMS_URL.searchParams.get("category")).toBe("Wildfire");
    const items = parseCems(cems, "gr", "2026-10-15");
    expect(items.map((i) => i.id)).toEqual(["EMSR999"]);
    expect(items[0]).toMatchObject({ url: "https://mapping.emergency.copernicus.eu/activations/EMSR999", lat: 38.5, lon: 23.69 });
  });
});

describe("fireAlerts", () => {
  it("matches events to regions and degrades to upstream_error when one source fails", async () => {
    fetchMock.mockImplementation(async (u: URL) => {
      if (u.hostname === "www.gdacs.org") throw Object.assign(new Error("t"), { name: "TimeoutError" });
      return new Response(JSON.stringify(cems), { status: 200 });
    });
    const r = await fireAlerts({ countries: ["gr"], days: 14 });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].matched_region?.id).toBe("EL64");
    expect(r.caveats.map((c) => c.code)).toEqual(expect.arrayContaining(["upstream_error", "untrusted_text"]));
    expect(r.window).toEqual({ from: "2026-11-01", to: "2026-11-14", days: 14 });
  });

  it("keeps only events in the requested region", async () => {
    fetchMock.mockImplementation(async (u: URL) =>
      new Response(JSON.stringify(u.hostname === "www.gdacs.org" ? gdacs : cems), { status: 200 }));
    const inEvia = await fireAlerts({ countries: ["gr"], region_id: "EL64", days: 14 });
    expect(inEvia.count).toBe(2);
    const inAttica = await fireAlerts({ countries: ["gr"], region_id: "EL30", days: 14 });
    expect(inAttica.count).toBe(0);
    expect(inAttica.outside_region).toBe(2);
  });
});
