// The calendar key matches the marks: anomaly outlines appear only on the region's own series (audit R2-004).
import { describe, expect, it } from "vitest";
import { marksKey } from "../src/charts/heatmap.ts";

describe("marksKey", () => {
  it("lists the anomaly mark on the region's own series", () => {
    expect(marksKey(false, "harm", "harm")).toMatch(/Anomaly: above the 90th percentile/);
    expect(marksKey(false, "modis", "modis")).toMatch(/Anomaly: above the 90th percentile/);
  });

  it("says where anomaly marks are when another series is shown", () => {
    for (const shown of ["modis", "viirs"] as const) {
      const key = marksKey(false, "harm", shown);
      expect(key).not.toMatch(/Anomaly: above/);
      expect(key).toMatch(/Anomaly marks show on the .* series only/);
    }
  });
});
