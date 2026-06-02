import type { EcliLinks } from "../lib/prudai.js";

export type SearchSource = "open-data";

/** Normalized single search hit, shape-stable across both backends. */
export interface UitspraakSummary {
  ecli: string;
  title?: string;
  summary?: string;
  court?: string;
  /** Uitspraakdatum as YYYY-MM-DD when the backend exposes it. */
  date?: string;
  /** "Uitspraak" | "Conclusie" when known. */
  type?: string;
  updated?: string;
  links: EcliLinks;
}

export interface SearchResponse {
  totalCount: number;
  source: SearchSource;
  results: UitspraakSummary[];
  /** True when a keyword query was supplied but the active backend cannot honour it. */
  keywordIgnored?: boolean;
}

export interface RelatedRef {
  ecli?: string;
  /** Relation type label, e.g. "Conclusie", "In cassatie op". */
  type?: string;
  label?: string;
}

export interface UitspraakDocument {
  ecli: string;
  source: SearchSource;
  metadata: Record<string, string>;
  /** Plain-text body of the uitspraak/conclusie, when published. */
  bodyText?: string;
  relations: RelatedRef[];
  links: EcliLinks;
}

export interface WaardelijstEntry {
  identifier?: string;
  naam?: string;
  afkorting?: string;
  type?: string;
}
