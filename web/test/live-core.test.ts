import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, ALLOWED_HOSTS, cleanText, clearLiveCache, fetchUpstream, liveResult, UpstreamError } from "../api/_lib/live/core.ts";

const fetchMock = vi.fn();
beforeEach(() => {
  clearLiveCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("cleanText", () => {
  it("strips control characters, tags and bidi marks, collapses whitespace and caps length", () => {
    expect(cleanText("Fire\u0000 in\n<b>Evia</b>‮ ok")).toBe("Fire in Evia ok");
    expect(cleanText("x".repeat(500), 10)).toHaveLength(10);
    expect(cleanText(42)).toBe("");
  });
});

describe("fetchUpstream", () => {
  it("refuses hosts outside the allowlist without calling fetch", async () => {
    await expect(fetchUpstream(new URL("https://example.com/x"), "json", 1000)).rejects.toBeInstanceOf(UpstreamError);
    await expect(fetchUpstream(new URL("http://www.gdacs.org/x"), "json", 1000)).rejects.toThrow(/allowlist/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ALLOWED_HOSTS.has("example.com")).toBe(false);
  });

  it("returns null on HTTP 204 and caches the answer per URL", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const u = new URL("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=WF");
    expect(await fetchUpstream(u, "json", 60_000)).toBeNull();
    expect(await fetchUpstream(u, "json", 60_000)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("turns a timeout into an UpstreamError that does not contain the URL", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
    const u = new URL("https://firms.modaps.eosdis.nasa.gov/api/area/csv/SECRETKEY123/MODIS_NRT/1,2,3,4/1");
    const err = (await fetchUpstream(u, "text", 1000).catch((e: unknown) => e)) as Error;
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.message).toMatch(/4000 ms/);
    expect(err.message).not.toContain("SECRETKEY123");
  });

  it("does not cache failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const u = new URL("https://api.open-meteo.com/v1/forecast?x=1");
    await expect(fetchUpstream(u, "json", 60_000)).rejects.toThrow(/HTTP 500/);
    expect(await fetchUpstream(u, "json", 60_000)).toEqual({ ok: 1 });
  });
});

describe("liveResult", () => {
  it("puts caveats first, adds live_upstream once, fetched_at and source", () => {
    const r = liveResult({ a: 1 }, [{ code: "forecast", message: "f" }, { code: "forecast", message: "f" }],
      [{ name: "n", url: "u", licence: "l", attribution: "a" }]);
    const lines = r.content[0].text.split("\n");
    expect(lines[0]).toMatch(/^CAVEAT live_upstream/);
    expect(lines[1]).toBe("CAVEAT forecast: f");
    const json = JSON.parse(lines[2]);
    expect(json.caveat_codes).toEqual(["live_upstream", "forecast"]);
    expect(r.structuredContent).toMatchObject({ a: 1, source: [{ name: "n" }] });
    expect(Date.parse((r.structuredContent as { fetched_at: string }).fetched_at)).not.toBeNaN();
  });

  it("codes mode keeps only caveat codes", () => {
    const r = liveResult({}, [], [], "codes");
    expect(r.content[0].text.split("\n")[0]).toBe("CAVEATS (codes): live_upstream");
    expect(r.structuredContent).toMatchObject({ caveat_codes: ["live_upstream"] });
  });
});

it("addDays crosses month ends", () => {
  expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
});
