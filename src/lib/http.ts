import { getConfig } from "../config.js";

export class HttpTimeoutError extends Error {
  public readonly code = "HTTP_TIMEOUT" as const;
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
  ) {
    super(`Request to ${url} timed out after ${timeoutMs}ms.`);
    this.name = "HttpTimeoutError";
  }
}

export class HttpStatusError extends Error {
  public readonly code = "HTTP_STATUS" as const;
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(`Request to ${url} failed with HTTP ${status}.`);
    this.name = "HttpStatusError";
  }
}

interface FetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /** Override the configured timeout for this request. */
  timeoutMs?: number;
  /** Treat these status codes as success even when >= 400 (caller inspects status). */
  acceptStatuses?: (status: number) => boolean;
}

export interface HttpResponse {
  status: number;
  text: string;
}

/**
 * Minimal fetch wrapper used by every upstream client. Adds a polite User-Agent,
 * an AbortController-based timeout, and uniform error types. Uses the global `fetch`
 * available in Node 18+ so the package ships with no HTTP dependency.
 */
export async function httpRequest(url: string, options: FetchOptions = {}): Promise<HttpResponse> {
  const config = getConfig();
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (config.debug) {
    console.error(`[http] ${options.method ?? "GET"} ${url}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "User-Agent": config.userAgent,
        ...options.headers,
      },
      ...(options.body !== undefined ? { body: options.body } : {}),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpTimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const ok = options.acceptStatuses
    ? options.acceptStatuses(response.status)
    : response.status >= 200 && response.status < 300;
  if (!ok) {
    throw new HttpStatusError(url, response.status, text.slice(0, 500));
  }
  return { status: response.status, text };
}

/** Run an async mapper over items with bounded concurrency, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await fn(items[currentIndex]!, currentIndex);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
