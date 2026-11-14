// MCP endpoint (Streamable HTTP, stateless, read-only). Smoke test: one tool over the static index.
// Data comes from public/data/** bundled via vercel.json functions."api/mcp.ts".includeFiles.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import type { CountryCode, IndexFile } from "../src/lib/contract.ts";

// Vercel bundles includeFiles at their repo-relative path: /var/task/public/... for a CLI deploy
// from web/, /var/task/web/public/... for a Git deploy with root directory web/. Locally cwd is web/.
const DATA_DIR =
  [join(process.cwd(), "public", "data", "v1"), join(process.cwd(), "web", "public", "data", "v1")].find((d) =>
    existsSync(join(d, "gr", "index.json")),
  ) ?? join(process.cwd(), "public", "data", "v1");

async function loadIndex(country: CountryCode): Promise<IndexFile> {
  return JSON.parse(await readFile(join(DATA_DIR, country, "index.json"), "utf8")) as IndexFile;
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_regions",
      {
        title: "Search regions",
        description:
          "List regions of the burning calendar (Greece NUTS2, Argentina provinces) with mode, peak month and season length. " +
          "Regions with mode 'relative' have no harmonized counts; do not compare their counts with harmonized regions.",
        inputSchema: z.object({
          country: z.enum(["GR", "AR"]),
          query: z.string().max(64).optional(),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ country, query }) => {
        const index = await loadIndex(country.toLowerCase() as CountryCode);
        const q = query?.toLowerCase();
        const regions = index.regions
          .filter((r) => !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase() === q)
          .map((r) => ({ id: r.id, name: r.name, level: r.level, mode: r.mode,
                         peak_month: r.peak_month, season_length: r.season_length }));
        return {
          content: [{ type: "text", text: JSON.stringify({ country, regions }) }],
        };
      },
    );
  },
  { serverInfo: { name: "burning-calendar", version: "0.1.0" } },
);

export { handler as GET, handler as POST };
