import { z } from "zod";
import { isValidEcli, parseEcli } from "../lib/ecli.js";
import { ATTRIBUTION, quotingInstruction } from "../lib/prudai.js";
import { getDocument, search, type SearchParams } from "../rechtspraak/service.js";
import { summaryFromDocument } from "./getDocument.js";
import { describeError, fail, ok, type McpTool } from "./tool.js";

export const searchUitspraken: McpTool = {
  name: "search_uitspraken",
  description: [
    "Search Dutch case law (jurisprudentie/uitspraken) via the official Open Data API and get back ECLIs with links to the ruling and a PrudAI viewer.",
    "This is a faceted search: filter by rechtsgebied, instantie, date range and document type. It does not do free-text keyword matching.",
    "If you already have an ECLI, pass it as `query` and the tool returns that single decision's summary.",
    "Use list_waardelijsten to discover valid rechtsgebied/instantie identifiers.",
  ].join(" "),
  inputSchema: {
    query: z.string().optional().describe("A single ECLI to look up directly. (Open Data has no free-text search; non-ECLI keywords are ignored — use the facet filters instead.)"),
    max: z.number().int().positive().max(1000).optional().describe("Max results to return (default 25)."),
    from: z.number().int().nonnegative().optional().describe("Zero-based pagination offset (default 0)."),
    dateFrom: z.string().optional().describe("Uitspraakdatum from, YYYY-MM-DD."),
    dateTo: z.string().optional().describe("Uitspraakdatum to, YYYY-MM-DD."),
    sort: z.enum(["relevance", "date"]).optional().describe("'date' for newest-first; otherwise the API's default order."),
    type: z.enum(["Uitspraak", "Conclusie"]).optional().describe("Restrict to rulings or AG conclusies."),
    rechtsgebied: z.string().optional().describe("Rechtsgebied slug (e.g. 'civielrecht', 'strafrecht', 'bestuursrecht', 'internationaalpubliekrecht') or full PSI URI."),
    instanties: z.array(z.string()).optional().describe("Court filter: a single OWMS creator URI (find it via list_waardelijsten)."),
  },
  outputSchema: {
    totalCount: z.number(),
    source: z.enum(["open-data"]),
    results: z.array(z.unknown()),
    keywordIgnored: z.boolean().optional(),
    guidance: z.string().optional(),
    attribution: z.string().optional(),
    success: z.boolean(),
  },
  run: async (args) => {
    const params = args as SearchParams;

    // Direct ECLI lookup short-circuit: return that decision's summary.
    if (params.query && isValidEcli(params.query)) {
      try {
        const ecli = parseEcli(params.query).normalized;
        const doc = await getDocument(ecli, { metadataOnly: true });
        return ok({
          totalCount: 1,
          source: "open-data",
          results: [summaryFromDocument(doc)],
          guidance: `Direct ECLI lookup. Fetch the full text with get_uitspraak. ${quotingInstruction(ecli)}`,
          attribution: ATTRIBUTION,
          success: true,
        });
      } catch (err) {
        return fail({ totalCount: 0, results: [], error: describeError(err), guidance: "Verify the ECLI exists and is published on rechtspraak.nl." });
      }
    }

    try {
      const response = await search(params);
      const guidanceParts: string[] = [];
      if (response.keywordIgnored) {
        guidanceParts.push(
          "A keyword query was supplied, but the Open Data search has NO free-text matching — results reflect only the facet filters (date/rechtsgebied/instantie/type). Narrow with those filters, or pass an ECLI for a direct lookup.",
        );
      } else {
        guidanceParts.push("Faceted Open Data search. Use list_waardelijsten to find rechtsgebied/instantie identifiers.");
      }
      guidanceParts.push("Fetch full text for any hit with get_uitspraak.");
      guidanceParts.push(quotingInstruction());

      return ok({
        totalCount: response.totalCount,
        source: response.source,
        results: response.results,
        ...(response.keywordIgnored ? { keywordIgnored: true } : {}),
        guidance: guidanceParts.join(" "),
        attribution: ATTRIBUTION,
        success: true,
      });
    } catch (err) {
      return fail({
        totalCount: 0,
        results: [],
        error: describeError(err),
        guidance: "Open Data search failed. Check filters/date format (YYYY-MM-DD) and connectivity to data.rechtspraak.nl.",
      });
    }
  },
};
