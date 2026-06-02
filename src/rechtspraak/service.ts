import { isValidEcli } from "../lib/ecli.js";
import { getContentOpenData, searchOpenData, getWaardelijst } from "./openData.js";
import type { SearchResponse, UitspraakDocument } from "./types.js";

export { getWaardelijst };
export type { WaardelijstName } from "./openData.js";
export { WAARDELIJST_NAMES } from "./openData.js";

/** Unified search parameters exposed by the search tool. */
export interface SearchParams {
  query?: string;
  max?: number;
  from?: number;
  dateFrom?: string;
  dateTo?: string;
  /** "date" sorts newest-first; otherwise the API's default order. */
  sort?: "relevance" | "date";
  type?: "Uitspraak" | "Conclusie";
  /** Rechtsgebied slug (e.g. "civielrecht") or full PSI URI. */
  rechtsgebied?: string;
  /** Court filter: a single OWMS creator URI (find it via list_waardelijsten). */
  instanties?: string[];
}

/**
 * Faceted search against the official Open Data API (data.rechtspraak.nl). There is no
 * free-text keyword search; a non-ECLI keyword cannot be honoured and is flagged so the
 * caller knows results reflect only the facet filters.
 */
export async function search(params: SearchParams): Promise<SearchResponse> {
  const creator = params.instanties?.find((i) => /^https?:\/\//i.test(i));
  const result = await searchOpenData({
    ...(params.max !== undefined ? { max: params.max } : {}),
    ...(params.from !== undefined ? { from: params.from } : {}),
    sort: params.sort === "date" ? "DESC" : "ASC",
    ...(params.type ? { type: params.type } : {}),
    ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
    ...(params.dateTo ? { dateTo: params.dateTo } : {}),
    ...(params.rechtsgebied ? { rechtsgebied: params.rechtsgebied } : {}),
    ...(creator ? { creator } : {}),
    documentsOnly: true,
  });

  const hasKeyword = !!params.query && params.query.trim().length > 0 && !isValidEcli(params.query);
  return hasKeyword ? { ...result, keywordIgnored: true } : result;
}

/** Fetch a single document from the Open Data content endpoint. */
export async function getDocument(
  ecli: string,
  opts: { metadataOnly?: boolean } = {},
): Promise<UitspraakDocument> {
  return getContentOpenData(ecli, opts);
}
