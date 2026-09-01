/**
 * Configuration for ictexam-mcp.
 *
 * Part of ictexam-mcp by Tahir Almas, ICT Innovations (https://ictinnovations.com).
 */

export interface Config {
  baseUrl: string;
  apiPrefix: string;
  email: string;
  password: string;
  allowWrite: boolean;
  timeoutMs: number;
  tlsInsecure: boolean;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function bool(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(value ?? "");
}

/**
 * Read config from the environment. Throws with a clear message when a required
 * value is missing, so the server fails loudly at startup rather than on the
 * first tool call.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const baseUrl = (env.ICTEXAM_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const email = (env.ICTEXAM_EMAIL ?? "").trim();
  const password = env.ICTEXAM_PASSWORD ?? "";

  const missing: string[] = [];
  if (!baseUrl) missing.push("ICTEXAM_BASE_URL");
  if (!email) missing.push("ICTEXAM_EMAIL");
  if (!password) missing.push("ICTEXAM_PASSWORD");
  if (missing.length) {
    throw new Error(
      `ictexam-mcp: missing required config: ${missing.join(", ")}.\n` +
        "See https://github.com/ictinnovations/ictexam-mcp for the full variable list."
    );
  }

  // Default "/api" for the usual reverse-proxied deployment; "" hits the backend directly.
  const rawPrefix = env.ICTEXAM_API_PREFIX;
  const apiPrefix =
    rawPrefix === undefined
      ? "/api"
      : rawPrefix.trim()
        ? "/" + rawPrefix.trim().replace(/^\/+|\/+$/g, "")
        : "";

  return {
    baseUrl,
    apiPrefix,
    email,
    password,
    allowWrite: bool(env.ICTEXAM_MCP_ALLOW_WRITE),
    timeoutMs: num(env.ICTEXAM_TIMEOUT_MS, 60000),
    tlsInsecure: bool(env.ICTEXAM_TLS_INSECURE),
  };
}
