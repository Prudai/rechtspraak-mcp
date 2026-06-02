import { z } from "zod";
import { parseEcli, InvalidEcliError } from "../lib/ecli.js";
import { ATTRIBUTION, linksForEcli } from "../lib/prudai.js";
import { lidoService, LidoParseError, LidoQueryError, type LidoLinkDirection, type LidoNode } from "../lido/service.js";
import { describeError, fail, ok, type McpTool } from "./tool.js";

const DIRECTIONS = ["both", "in", "out"] as const;

/** Attach PrudAI/official links to every ECLI (jurisprudentie) node in the subgraph. */
function enrichNode(node: LidoNode): LidoNode & { links?: ReturnType<typeof linksForEcli> } {
  if (node.kind === "jurisprudentie" && /^ECLI:/.test(node.id)) {
    return { ...node, links: linksForEcli(node.id) };
  }
  return node;
}

export const lidoRelated: McpTool = {
  name: "lido_related",
  description: [
    "Get the LiDO citation graph around a Dutch ECLI: rulings that cite it or are cited by it, referenced statute articles, and official publications, with typed Dutch link labels (e.g. 'Verwijst naar', 'Conclusie', 'Vernietigt').",
    "Data comes from KOOP's live LiDO service (linkeddata.overheid.nl). Use it to position a ruling (is it a landmark? what does it cite?).",
    "Read-only and bounded (per-direction limit default 100, max 250). This returns structure, not full text — use get_uitspraak for the text of any neighbour.",
  ].join(" "),
  inputSchema: {
    ecli: z.string().min(8).describe("ECLI identifier, e.g. ECLI:NL:HR:2019:1278. Case-sensitive local segment."),
    direction: z.enum(DIRECTIONS).optional().describe("'both' (default), 'in' (only citing), 'out' (only cited)."),
    limit: z.number().int().min(1).max(250).optional().describe("Per-direction edge limit (default 100)."),
    linkTypeCodes: z.array(z.string().min(1)).optional().describe("Optional filter on link-type codes (e.g. ['lx-referentie', 'rvr-conclusie'])."),
  },
  outputSchema: {
    subgraph: z.unknown().nullable(),
    guidance: z.string().optional(),
    attribution: z.string().optional(),
    success: z.boolean(),
  },
  run: async (args) => {
    let ecli: string;
    try {
      ecli = parseEcli(args.ecli as string).normalized;
    } catch (err) {
      if (err instanceof InvalidEcliError) {
        return fail({ subgraph: null, error: describeError(err), guidance: "Expected ECLI:CC:COURT:YYYY:NUMBER, e.g. ECLI:NL:HR:2019:1278." });
      }
      throw err;
    }

    try {
      const subgraph = await lidoService.getEcliSubgraph({
        ecli,
        ...(args.direction ? { direction: args.direction as LidoLinkDirection } : {}),
        ...(args.limit ? { limit: args.limit as number } : {}),
        ...(Array.isArray(args.linkTypeCodes) && args.linkTypeCodes.length ? { linkTypeCodes: args.linkTypeCodes as string[] } : {}),
      });

      const enriched = {
        ...subgraph,
        center: enrichNode(subgraph.center),
        nodes: subgraph.nodes.map(enrichNode),
      };

      const truncated = subgraph.truncation.incoming || subgraph.truncation.outgoing;
      return ok({
        subgraph: enriched,
        guidance: [
          `Centre: ${subgraph.center.label}. ${subgraph.stats.inboundCount} inbound + ${subgraph.stats.outboundCount} outbound neighbours.`,
          truncated ? "Truncation hit — more citations exist than shown; narrow by rechtsgebied or link-type, or lower the limit." : "",
          "Cite specific neighbour rulings with their ECLI and fetch the text via get_uitspraak.",
        ].filter(Boolean).join(" "),
        attribution: ATTRIBUTION,
        success: true,
      });
    } catch (err) {
      if (err instanceof LidoParseError) {
        return fail({ subgraph: null, error: describeError(err), guidance: "LiDO returned an unexpected shape. Retry once; the endpoint may be degraded." });
      }
      if (err instanceof LidoQueryError) {
        return fail({ subgraph: null, error: describeError(err), guidance: "LiDO query failed (rate-limited or temporarily unavailable). Retry once, then continue without the citation graph." });
      }
      return fail({ subgraph: null, error: describeError(err), guidance: "Unexpected LiDO failure." });
    }
  },
};
