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
  /**
   * Citation-network augmentation for search results. 'off' (default) returns plain hits;
   * 'graph' attaches linked jurisprudence extracted from each hit's own text (ECLI regex,
   * works offline); 'lido' uses KOOP's live LiDO service (needs network/allowlist).
   */
  citationNetwork: "off" | "graph" | "lido";
  /** When citationNetwork is on, expand at most this many top search hits. */
  citationNetworkTopK: number;
  /** Max related ECLIs returned per expanded hit. */
  citationNetworkPerHit: number;
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

function readEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
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
    citationNetwork: readEnum(process.env.RECHTSPRAAK_CITATION_NETWORK, ["off", "graph", "lido"] as const, "off"),
    citationNetworkTopK: readInt(process.env.RECHTSPRAAK_CITATION_NETWORK_TOPK, 10),
    citationNetworkPerHit: readInt(process.env.RECHTSPRAAK_CITATION_NETWORK_PER_HIT, 50),
  };
  return cached;
}

/** Test helper: drop the memoized config so the next getConfig() re-reads env. */
export function resetConfigForTests(): void {
  cached = undefined;
}
