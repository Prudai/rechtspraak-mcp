import { z } from "zod";
import { getConfig } from "../config.js";
import { isTuchtrechtEcli, parseEcli } from "../lib/ecli.js";
import { mapWithConcurrency } from "../lib/http.js";
import { ATTRIBUTION, quotingInstruction } from "../lib/prudai.js";
import { getDocument } from "../rechtspraak/service.js";
import { describeError, ok, type McpTool } from "./tool.js";

export const getUitsprakenBulk: McpTool = {
  name: "get_uitspraken_bulk",
  description: [
    "Fetch multiple Dutch court decisions by ECLI in one call (1–10 ECLIs) from the official Open Data API.",
    "Returns a per-ECLI result with the body text, metadata, relations, and links — or an error for any ECLI that is unpublished or not found.",
  ].join(" "),
  inputSchema: {
    eclis: z.array(z.string().min(1)).min(1).max(10).describe("1–10 ECLI identifiers."),
    metadataOnly: z.boolean().optional().describe("When true, fetch metadata only (no body text)."),
  },
  outputSchema: {
    results: z.array(z.unknown()),
    requested: z.number(),
    fetched: z.number(),
    failed: z.number(),
    guidance: z.string().optional(),
    attribution: z.string().optional(),
    success: z.boolean(),
  },
  run: async (args) => {
    const raw = (args.eclis as string[]) ?? [];
    const metadataOnly = args.metadataOnly === true;
    const unique = Array.from(new Set(raw.map((e) => (typeof e === "string" ? e.trim() : "")).filter(Boolean)));
    const concurrency = Math.min(getConfig().bulkConcurrency, unique.length);

    const results = await mapWithConcurrency(unique, concurrency, async (input) => {
      let ecli: string;
      try {
        ecli = parseEcli(input).normalized;
      } catch (err) {
        return { ecli: input, success: false, error: describeError(err) };
      }
      if (isTuchtrechtEcli(ecli)) {
        return { ecli, success: false, error: `${ecli} is a tuchtrecht (disciplinary) ECLI, not on Rechtspraak.` };
      }
      try {
        const doc = await getDocument(ecli, { metadataOnly });
        return {
          ecli,
          success: true,
          metadata: doc.metadata,
          ...(doc.bodyText ? { bodyText: doc.bodyText } : {}),
          relations: doc.relations,
          links: doc.links,
        };
      } catch (err) {
        return { ecli, success: false, error: describeError(err) };
      }
    });

    const fetched = results.filter((r) => r.success).length;
    return ok({
      results,
      requested: unique.length,
      fetched,
      failed: results.length - fetched,
      guidance: quotingInstruction(),
      attribution: ATTRIBUTION,
      success: results.length - fetched === 0,
    });
  },
};
