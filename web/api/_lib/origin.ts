// Origin check in front of mcp-handler. The 2026-07-28 Streamable HTTP spec says servers MUST validate Origin and
// answer 403 when it is present and invalid; mcp-handler 2.4.0 and the SDK entry it wraps do not check it
// (the SDK leaves it to the caller and ships originValidationResponse for that).
// No Origin header (server-to-server: claude.ai and ChatGPT connectors, Claude Code, Cursor, curl) passes.
import { localhostAllowedOrigins, originValidationResponse } from "@modelcontextprotocol/server";

/** Hostnames, any scheme and port (SDK convention). List and reasons: docs/wiki/agent-access.md, Security. */
export const ALLOWED_ORIGIN_HOSTS: readonly string[] = [
  "burning-calendar.vercel.app", // our own site
  ...localhostAllowedOrigins(), // localhost, 127.0.0.1, [::1]: MCP Inspector, vite dev, vercel dev
  "claude.ai",
  "claude.com",
  "chatgpt.com",
  "chat.openai.com",
];

/** Extra hostnames from the env var MCP_ALLOWED_ORIGINS (comma separated), e.g. a preview deployment. */
export function allowedOriginHosts(env: string | undefined = process.env.MCP_ALLOWED_ORIGINS): string[] {
  const extra = (env ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...ALLOWED_ORIGIN_HOSTS, ...extra];
}

/** Enforce only when MCP_ORIGIN_ENFORCE=1. Default is report-only, so an unknown web MCP client is logged, not blocked. */
export const originEnforced = (env: string | undefined = process.env.MCP_ORIGIN_ENFORCE) => env === "1";

/**
 * Wraps a fetch-style handler. Enforced: 403 with a JSON-RPC error for a disallowed Origin. Report-only (default):
 * log the Origin and serve the request; the server is public, read-only and keyless, so DNS rebinding gains nothing.
 */
export function withOriginCheck(
  handler: (req: Request) => Promise<Response>,
  hosts: readonly string[] = allowedOriginHosts(),
  enforce: boolean = originEnforced(),
) {
  const list = [...hosts];
  return async (req: Request): Promise<Response> => {
    const denied = originValidationResponse(req, list);
    if (!denied) return handler(req);
    if (enforce) return denied;
    console.warn(`[mcp] Origin not in allowlist (report-only): ${(req.headers.get("origin") ?? "").slice(0, 200)}`);
    return handler(req);
  };
}
