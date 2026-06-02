import { z } from "zod";
import { ATTRIBUTION } from "../lib/prudai.js";
import { getWaardelijst, WAARDELIJST_NAMES, type WaardelijstName } from "../rechtspraak/service.js";
import { describeError, fail, ok, type McpTool } from "./tool.js";

export const listWaardelijsten: McpTool = {
  name: "list_waardelijsten",
  description: [
    "List the Rechtspraak value lists (waardelijsten) used to build valid search filters:",
    `${WAARDELIJST_NAMES.join(", ")}.`,
    "'rechtsgebieden' and 'instanties' return the identifiers/URIs you pass to search_uitspraken (rechtsgebied / instanties).",
    "Call without a name to see the available lists.",
  ].join(" "),
  inputSchema: {
    name: z.enum(WAARDELIJST_NAMES as [WaardelijstName, ...WaardelijstName[]]).optional().describe("Which value list to fetch. Omit to list available names."),
  },
  outputSchema: {
    name: z.string().optional(),
    available: z.array(z.string()).optional(),
    count: z.number().optional(),
    entries: z.array(z.unknown()).optional(),
    attribution: z.string().optional(),
    success: z.boolean(),
  },
  run: async (args) => {
    const name = args.name as WaardelijstName | undefined;
    if (!name) {
      return ok({ available: WAARDELIJST_NAMES, attribution: ATTRIBUTION, success: true, guidance: "Re-call with one of the listed names to fetch its entries." });
    }
    try {
      const entries = await getWaardelijst(name);
      return ok({ name, count: entries.length, entries, attribution: ATTRIBUTION, success: true });
    } catch (err) {
      return fail({ name, error: describeError(err), guidance: "Could not fetch the value list. Retry or check connectivity to data.rechtspraak.nl." });
    }
  },
};
