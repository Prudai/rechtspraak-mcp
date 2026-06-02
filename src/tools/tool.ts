import type { ZodRawShape } from "zod";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  outputSchema?: ZodRawShape;
  run: (args: Record<string, unknown>) => Promise<ToolResult>;
}

/** Build a successful tool result with both a text rendering and structured content. */
export function ok(structuredContent: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

/** Build an error tool result. */
export function fail(structuredContent: Record<string, unknown>): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ success: false, ...structuredContent }, null, 2) }],
    structuredContent: { success: false, ...structuredContent },
  };
}

/** Normalize any thrown value into a human-readable message. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
