import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, SERVER_NAME } from "./server.js";

/**
 * stdio entrypoint for `npx rechtspraak-mcp`.
 *
 * stdout is reserved for the MCP protocol stream, so every log goes to stderr — a stray
 * console.log on stdout would corrupt the JSON-RPC framing.
 */
async function main(): Promise<void> {
  // Route any incidental console.log/warn to stderr to protect the protocol stream.
  console.log = ((...args: unknown[]) => console.error(...args)) as typeof console.log;
  console.warn = ((...args: unknown[]) => console.error(...args)) as typeof console.warn;

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} is running on stdio.`);
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] fatal:`, err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
