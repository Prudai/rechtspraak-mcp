import { z } from "zod";
import { getConfig } from "../config.js";
import { mapWithConcurrency } from "../lib/http.js";
import { ATTRIBUTION, quotingInstruction } from "../lib/prudai.js";
import { search } from "../rechtspraak/service.js";
import { describeError, ok, type McpTool } from "./tool.js";

export const searchUitsprakenBulk: McpTool = {
  name: "search_uitspraken_bulk",
  description: [
    "Run several Open Data lookups at once (3–10 entries). Pass ECLIs to resolve a batch of decisions' summaries in one call.",
    "Note: Open Data has no free-text matching, so non-ECLI terms fall back to facet-only results — prefer get_uitspraken_bulk when you already have the ECLIs.",
    "Use to cast a broad net before narrowing down via get_uitspraak.",
  ].join(" "),
  inputSchema: {
    terms: z.array(z.string().min(1)).min(3).max(10).describe("3–10 distinct search terms, phrased differently."),
    pageSize: z.number().int().positive().max(10).optional().describe("Results per term (max 10, default 10)."),
    from: z.number().int().nonnegative().optional().describe("Zero-based offset per term (default 0)."),
  },
  outputSchema: {
    queries: z.array(z.object({ term: z.string(), totalCount: z.number(), source: z.string(), results: z.array(z.unknown()) })),
    totalResults: z.number(),
    guidance: z.string().optional(),
    attribution: z.string().optional(),
    success: z.boolean(),
  },
  run: async (args) => {
    const terms = (args.terms as string[]) ?? [];
    const pageSize = Math.min(10, Math.max(1, (args.pageSize as number) ?? 10));
    const from = (args.from as number) ?? 0;
    const concurrency = Math.min(getConfig().bulkConcurrency, terms.length);

    const queries = await mapWithConcurrency(terms, concurrency, async (term) => {
      try {
        const r = await search({ query: term, max: pageSize, from });
        return { term, totalCount: r.totalCount, source: r.source, results: r.results };
      } catch (err) {
        return { term, totalCount: 0, source: "open-data", results: [], error: describeError(err) };
      }
    });

    const totalResults = queries.reduce((acc, q) => acc + q.results.length, 0);
    return ok({
      queries,
      totalResults,
      guidance: `Fetch full text for promising hits with get_uitspraak. ${quotingInstruction()}`,
      attribution: ATTRIBUTION,
      success: true,
    });
  },
};
