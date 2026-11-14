import { describe, expect, it } from "vitest";
import { shownSeries, type Mode, type Series } from "../src/lib/contract.ts";
import { parseState, serializeState, type AppState } from "../src/lib/url-state.ts";

// Region modes from public/data/v1/gr/index.json: GR harmonized, EL62 (Ionia Nisia) relative.
const MODE: Record<string, Mode> = { GR: "harmonized", EL62: "relative" };

/** What main.ts does on a region switch: the choice stays in the state, the panel shows shownSeries. */
function goTo(s: AppState, region: string): { state: AppState; shown: Series; url: string } {
  const state = { ...s, region };
  return { state, shown: shownSeries(MODE[region], state.series), url: serializeState(state) };
}

/** A press on a series button counts only when it changes the shown series. */
function press(s: AppState, series: Series): AppState {
  return series === shownSeries(MODE[s.region!], s.series) ? s : { ...s, series };
}

describe("shownSeries", () => {
  it("keeps a series the mode offers", () => {
    expect(shownSeries("harmonized", "harm")).toBe("harm");
    expect(shownSeries("harmonized", "viirs")).toBe("viirs");
    expect(shownSeries("relative", "viirs")).toBe("viirs");
  });
  it("falls back to MODIS where harm does not exist", () => {
    expect(shownSeries("relative", "harm")).toBe("modis");
  });
});

describe("series across region switches (Greece, Ionia Nisia)", () => {
  it("returns to Harmonized after a relative region forced MODIS", () => {
    let v = goTo(parseState("?country=gr&region=GR"), "GR");
    expect(v.shown).toBe("harm");
    v = goTo(v.state, "EL62");
    expect(v.shown).toBe("modis");
    expect(v.url).toBe("?country=gr&region=EL62");
    v = goTo(v.state, "GR");
    expect(v.shown).toBe("harm");
    expect(v.url).toBe("?country=gr&region=GR");
  });

  it("keeps a manual MODIS choice through a relative region", () => {
    let s = press(parseState("?country=gr&region=GR"), "modis");
    let v = goTo(s, "EL62");
    expect(v.shown).toBe("modis");
    v = goTo(v.state, "GR");
    expect(v.shown).toBe("modis");
    expect(v.url).toBe("?country=gr&region=GR&series=modis");
    s = press(v.state, "harm");
    expect(goTo(s, "GR").url).toBe("?country=gr&region=GR");
  });

  it("keeps a manual VIIRS then MODIS choice made on the relative region", () => {
    let s = parseState("?country=gr&region=EL62");
    s = press(s, "viirs");
    s = press(s, "modis");
    expect(goTo(s, "GR").shown).toBe("modis");
  });

  it("pressing the MODIS button already forced by relative mode is not a choice", () => {
    const s = press(parseState("?country=gr&region=EL62"), "modis");
    expect(goTo(s, "GR").shown).toBe("harm");
  });

  it("a deep link with series=harm (or the unknown series=harmonized) on a relative region", () => {
    for (const q of ["?country=gr&region=EL62&series=harm", "?country=gr&region=EL62&series=harmonized"]) {
      const s = parseState(q);
      expect(goTo(s, "EL62").shown).toBe("modis");
      expect(goTo(s, "GR").shown).toBe("harm");
    }
  });

  it("a deep link with series=viirs keeps VIIRS on both", () => {
    const s = parseState("?country=gr&region=EL62&series=viirs");
    expect(goTo(s, "EL62").shown).toBe("viirs");
    expect(goTo(s, "GR").url).toBe("?country=gr&region=GR&series=viirs");
  });
});
