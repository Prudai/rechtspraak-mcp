import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ALL_TOOLS, type McpTool } from "./tools/index.js";
import { ATTRIBUTION } from "./lib/prudai.js";

export const SERVER_NAME = "rechtspraak-mcp";
export const SERVER_VERSION = "0.1.0";

/**
 * Build the MCP server with all tools registered under bare names.
 *
 * Note: tool `outputSchema` is intentionally NOT passed to `registerTool`. The SDK would
 * then validate every result (including error envelopes) against it; our error results
 * deliberately carry a different shape. The schemas remain on the tool objects as docs.
 */
export function createServer(tools: readonly McpTool[] = ALL_TOOLS): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, description: `Dutch case law (Rechtspraak Open Data + LiDO) over MCP. ${ATTRIBUTION}` },
    { capabilities: { logging: {}, tools: {} } },
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { title: tool.name, description: tool.description, inputSchema: tool.inputSchema },
      tool.run as never,
    );
  }

  return server;
}
