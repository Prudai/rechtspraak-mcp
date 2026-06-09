/**
 * Citation-network augmentation for search results — backend-pluggable, off by default.
 *
 * Controlled by the RECHTSPRAAK_CITATION_NETWORK env flag (see config.ts):
 *   off   — no augmentation (default; avoids the extra fetches and the noise it can add).
 *   graph — LiDO-free: pull the linked jurisprudence straight out of each hit's own document
 *           (typed relations + ECLIs regex-extracted from the body). Works offline / on any host.
 *   lido  — use KOOP's live LiDO citation graph (needs network access; blocked from datacenter
 *           IPs until allowlisted, so it is opt-in and degrades gracefully).
 *
 * Every function here is failure-tolerant: an expansion error never breaks the search — it is
 * reported in the result's `error` field with an empty `related` list.
 */
import { getConfig } from "../config.js";
import { extractEclis, parseEcli } from "../lib/ecli.js";
import { lidoService } from "../lido/service.js";
import { getDocument } from "./service.js";
import type { RelatedRef } from "./types.js";

export type CitationBackend = "off" | "graph" | "lido";

export interface CitationNetworkResult {
  /** The ECLI whose linked jurisprudence this describes. */
  ecli: string;
  /** Which backend produced it. */
  backend: CitationBackend;
  /** Linked-jurisprudence ECLIs (normalized, de-duplicated, self excluded). */
  related: string[];
  /** True when more links existed than the per-hit cap. */
  truncated?: boolean;
  /** Set (with related=[]) when the expansion failed; never throws to the caller. */
  error?: string;
}

/** Cited ECLIs from an already-fetched document: typed relations + ECLIs in the body text. */
export function citedEclisFromDocument(doc: {
  ecli: string;
  bodyText?: string;
  relations?: RelatedRef[];
}): string[] {
  const self = new Set<string>([doc.ecli.trim().toUpperCase()]);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw?: string): void => {
    if (!raw) return;
    let normalized: string;
    try {
      normalized = parseEcli(raw).normalized;
    } catch {
      return;
    }
    const key = normalized.toUpperCase();
    if (self.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  };
  for (const rel of doc.relations ?? []) push(rel.ecli);
  for (const ecli of extractEclis(doc.bodyText ?? "", { exclude: self })) push(ecli);
  return out;
}

async function expandViaGraph(ecli: string, perHit: number): Promise<CitationNetworkResult> {
  const doc = await getDocument(ecli, {}); // full text (relations + body)
  const all = citedEclisFromDocument(doc);
  return { ecli, backend: "graph", related: all.slice(0, perHit), truncated: all.length > perHit };
}

async function expandViaLido(ecli: string, perHit: number): Promise<CitationNetworkResult> {
  const subgraph = await lidoService.getEcliSubgraph({ ecli, direction: "out", limit: perHit });
  const upper = ecli.toUpperCase();
  const related = subgraph.nodes
    .filter((n) => n.kind === "jurisprudentie" && /^ECLI:/i.test(n.id) && n.id.toUpperCase() !== upper)
    .map((n) => n.id);
  return { ecli, backend: "lido", related: related.slice(0, perHit), truncated: subgraph.truncation.outgoing };
}

/** Expand the citation network for a single ECLI using the configured (or overridden) backend. Never throws. */
export async function expandCitationNetwork(
  ecli: string,
  backendOverride?: CitationBackend,
): Promise<CitationNetworkResult | null> {
  const cfg = getConfig();
  const backend = backendOverride ?? cfg.citationNetwork;
  if (backend === "off") return null;
  try {
    return backend === "lido"
      ? await expandViaLido(ecli, cfg.citationNetworkPerHit)
      : await expandViaGraph(ecli, cfg.citationNetworkPerHit);
  } catch (err) {
    return { ecli, backend, related: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Expand the top-K hits' citation networks with bounded concurrency. Returns [] when off / empty. */
export async function expandSearchResults(eclis: string[]): Promise<CitationNetworkResult[]> {
  const cfg = getConfig();
  if (cfg.citationNetwork === "off" || eclis.length === 0) return [];
  const targets = eclis.slice(0, cfg.citationNetworkTopK);
  const out: Array<CitationNetworkResult | undefined> = new Array(targets.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < targets.length) {
      const idx = next++;
      const result = await expandCitationNetwork(targets[idx]!);
      if (result) out[idx] = result;
    }
  };
  const workers = Math.max(1, Math.min(cfg.bulkConcurrency, targets.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out.filter((r): r is CitationNetworkResult => r !== undefined);
}
