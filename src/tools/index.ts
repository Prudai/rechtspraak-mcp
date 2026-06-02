import type { McpTool } from "./tool.js";
import { searchUitspraken } from "./search.js";
import { searchUitsprakenBulk } from "./searchBulk.js";
import { getUitspraak } from "./getDocument.js";
import { getUitsprakenBulk } from "./getDocumentsBulk.js";
import { listWaardelijsten } from "./listWaardelijsten.js";
import { lidoRelated } from "./lidoRelated.js";

/** Every tool exposed by the rechtspraak-mcp server, in advertised order. */
export const ALL_TOOLS: readonly McpTool[] = [
  searchUitspraken,
  searchUitsprakenBulk,
  getUitspraak,
  getUitsprakenBulk,
  listWaardelijsten,
  lidoRelated,
];

export type { McpTool } from "./tool.js";
