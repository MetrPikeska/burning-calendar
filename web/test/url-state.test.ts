import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, parseState, serializeState } from "../src/lib/url-state.ts";

describe("url-state", () => {
  it("round-trips a full state", () => {
    const s = { country: "ar", region: "30", from: "2020-01", to: "2020-12", series: "modis" } as const;
    expect(parseState(serializeState(s))).toEqual(s);
  });

  it("falls back to defaults on junk", () => {
    const s = parseState("?country=xx&region=<script>&from=2020-13&series=frp");
    expect(s).toEqual(DEFAULT_STATE);
  });

  it("omits the default series", () => {
    expect(serializeState({ ...DEFAULT_STATE, region: "EL52" })).toBe("?country=gr&region=EL52");
  });
});
