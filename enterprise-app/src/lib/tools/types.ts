import { z } from "zod";

export type ToolCategory = "files" | "web" | "utility";

export interface ToolResult {
  ok: true;
  // Optional file output
  file?: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
  };
  // Optional inline data shown to the model
  data?: unknown;
  // Optional human-readable summary for the model
  message?: string;
}

export interface ToolError {
  ok: false;
  error: string;
}

export type ToolExecutionResult = ToolResult | ToolError;

export interface ToolContext {
  conversationId?: string | null;
  userId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolExecuteFn = (args: any, ctx: ToolContext) => Promise<ToolExecutionResult>;

export interface ToolDefinition {
  id: string;
  displayName: string;
  category: ToolCategory;
  description: string;            // shown to the model
  uiHint: string;                 // shown to the user in settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: z.ZodObject<any>;
  execute: ToolExecuteFn;
}
