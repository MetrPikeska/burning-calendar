import { describe, expect, it } from "vitest";
import { GET, recentFor } from "../api/recent.ts";

describe("/api/recent", () => {
  it("rejects a malformed region id without calling upstream", async () => {
    const res = await GET(new Request("https://x.test/api/recent?region=../etc"));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 404 for an unknown region", async () => {
    const res = await GET(new Request("https://x.test/api/recent?region=EL99"));
    expect(res.status).toBe(404);
  });

  it("says not configured without a FIRMS key and never caches that", async () => {
    const body = await recentFor("EL52", {});
    expect(body.configured).toBe(false);
    expect(body.total).toBe(0);
    expect(body.caveats).toContain("not_configured");
    expect(body.calendar_context).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/MAP_KEY=|api\/area\/csv\/[0-9a-f]{20,}/);
  });
});
