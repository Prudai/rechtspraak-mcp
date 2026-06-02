/**
 * Runtime configuration, resolved once from environment variables with sane defaults.
 */
export interface RechtspraakMcpConfig {
  /** HTTP request timeout in milliseconds. */
  timeoutMs: number;
  /** Max concurrent upstream requests for the bulk tools. */
  bulkConcurrency: number;
  /** Base URL for PrudAI deeplinks embedded in results. */
  prudaiBaseUrl: string;
  /** User-Agent sent on every upstream request. */
  userAgent: string;
  /** Emit verbose upstream-request logs to stderr. */
  debug: boolean;
}

function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

let cached: RechtspraakMcpConfig | undefined;

export function getConfig(): RechtspraakMcpConfig {
  if (cached) return cached;
  cached = {
    timeoutMs: readInt(process.env.RECHTSPRAAK_HTTP_TIMEOUT_MS, 30_000),
    bulkConcurrency: readInt(process.env.RECHTSPRAAK_BULK_CONCURRENCY, 4),
    prudaiBaseUrl: (process.env.PRUDAI_BASE_URL || "https://prudai.com").replace(/\/+$/, ""),
    userAgent:
      process.env.RECHTSPRAAK_USER_AGENT ||
      "rechtspraak-mcp/0.1.0 (+https://github.com/Prudai/rechtspraak-mcp)",
    debug: readBool(process.env.RECHTSPRAAK_DEBUG, false),
  };
  return cached;
}

/** Test helper: drop the memoized config so the next getConfig() re-reads env. */
export function resetConfigForTests(): void {
  cached = undefined;
}
