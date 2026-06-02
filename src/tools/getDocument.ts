import { z } from "zod";
import { isTuchtrechtEcli, parseEcli, InvalidEcliError } from "../lib/ecli.js";
import { HttpTimeoutError } from "../lib/http.js";
import { ATTRIBUTION, linksForEcli, quotingInstruction } from "../lib/prudai.js";
import { getDocument } from "../rechtspraak/service.js";
import { RechtspraakNotFoundError, RechtspraakNotPublishedError } from "../rechtspraak/errors.js";
import type { UitspraakDocument, UitspraakSummary } from "../rechtspraak/types.js";
import { describeError, fail, ok, type McpTool } from "./tool.js";

const TUCHTRECHT_GUIDANCE =
  "This looks like a tuchtrecht (disciplinary) ECLI (instantie code starts with 'T'). Rechtspraak does not host tuchtrecht decisions, so there is no document to fetch here.";

/** Project a fetched document down to a search-result summary. */
export function summaryFromDocument(doc: UitspraakDocument): UitspraakSummary {
  const m = doc.metadata;
  return {
    ecli: doc.ecli,
    ...(m.title ? { title: m.title } : {}),
    ...(m.creator ? { court: m.creator } : {}),
    ...(m.date ? { date: m.date } : {}),
    ...(m.type ? { type: m.type } : {}),
    links: doc.links,
  };
}

export const getUitspraak: McpTool = {
  name: "get_uitspraak",
  description: [
    "Fetch the full text and metadata of a single Dutch court decision by ECLI, from the official Open Data API (data.rechtspraak.nl).",
    "Returns metadata (court, date, rechtsgebied, zaaknummer), the plain-text body, formal relations (conclusie/cassatie/etc.), and links to the ruling on rechtspraak.nl plus a PrudAI viewer.",
    "If the ECLI is not published or has no body text, the tool says so — do not invent or cite it in that case.",
  ].join(" "),
  inputSchema: {
    ecli: z.string().optional().describe("ECLI identifier, e.g. ECLI:NL:HR:2023:1234 (alias: id)."),
    id: z.string().optional().describe("Alias for ecli."),
    metadataOnly: z.boolean().optional().describe("When true, fetch metadata only (no body text)."),
  },
  outputSchema: {
    ecli: z.string(),
    source: z.string(),
    metadata: z.record(z.string()),
    bodyText: z.string().optional(),
    relations: z.array(z.unknown()),
    links: z.record(z.string()),
    guidance: z.string().optional(),
    attribution: z.string().optional(),
    success: z.boolean(),
  },
  run: async (args) => {
    const target = (args.ecli as string | undefined) || (args.id as string | undefined);
    if (!target) {
      return fail({ error: "Missing ECLI. Provide 'ecli' or 'id'.", guidance: "Call with {\"ecli\": \"ECLI:NL:HR:2023:1234\"}." });
    }

    let ecli: string;
    try {
      ecli = parseEcli(target).normalized;
    } catch (err) {
      if (err instanceof InvalidEcliError) {
        return fail({ error: describeError(err), guidance: "Expected format ECLI:CC:COURT:YYYY:NUMBER, e.g. ECLI:NL:HR:2023:1234." });
      }
      throw err;
    }

    if (isTuchtrechtEcli(ecli)) {
      return fail({ ecli, error: `${ecli} is a tuchtrecht (disciplinary) ECLI, not on Rechtspraak.`, guidance: TUCHTRECHT_GUIDANCE });
    }

    try {
      const doc = await getDocument(ecli, { metadataOnly: args.metadataOnly === true });
      return ok({
        ecli: doc.ecli,
        source: doc.source,
        metadata: doc.metadata,
        ...(doc.bodyText ? { bodyText: doc.bodyText } : {}),
        relations: doc.relations,
        links: doc.links,
        guidance: quotingInstruction(doc.ecli),
        attribution: ATTRIBUTION,
        success: true,
      });
    } catch (err) {
      if (err instanceof RechtspraakNotFoundError) {
        return fail({ ecli, links: linksForEcli(ecli), error: describeError(err), guidance: "No such ECLI on Rechtspraak. Find a valid one via search_uitspraken." });
      }
      if (err instanceof RechtspraakNotPublishedError) {
        return fail({ ecli, links: linksForEcli(ecli), error: describeError(err), guidance: "This ECLI exists but has no published body text — do not cite it. Find a published alternative via search_uitspraken." });
      }
      if (err instanceof HttpTimeoutError) {
        return fail({ ecli, error: describeError(err), guidance: "Upstream timed out. Retry; if it persists, raise RECHTSPRAAK_HTTP_TIMEOUT_MS." });
      }
      return fail({ ecli, error: describeError(err), guidance: "Unexpected error fetching the decision." });
    }
  },
};
