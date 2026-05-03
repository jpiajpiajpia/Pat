import { getModelCapabilities, exampleToolCall, type ToolFormat } from "../modelCapabilities";

interface ToolForPrompt {
  id: string;
  description: string;
  /** A short JSON example of the args, for the prompt */
  exampleArgs?: Record<string, unknown>;
}

/**
 * Build the tool-format instruction block injected into the system prompt.
 *
 * This is the single most important fix for local-model tool calling: we
 * tell the model *exactly* what format to use, give it one positive example,
 * and one anti-example. This dramatically improves tool-call success rates
 * across Qwen, Llama, Gemma, Mistral.
 */
export function buildToolPrompt(modelId: string, tools: ToolForPrompt[]): string {
  if (tools.length === 0) return "";

  const caps = getModelCapabilities(modelId);
  const fmt = caps.toolFormat;

  // Pick a representative tool for the example (prefer create_text or first tool)
  const example = tools.find((t) => t.id === "create_text") ?? tools[0];
  const exampleArgs = example.exampleArgs ?? defaultArgsFor(example.id);
  const goodExample = exampleToolCall(fmt, example.id, exampleArgs);

  const toolList = tools
    .map((t) => `- **${t.id}**: ${oneLine(t.description)}`)
    .join("\n");

  return `

# Available tools

You have access to the following tools. To call a tool, emit a tool-call block in EXACTLY the format shown below. The system parses these blocks and executes the tools — your output is what actually causes the action.

## Format

When you want to use a tool, output a block like this:

${goodExample}

The block must:
- Use the exact wrapper shown (${wrapperHint(fmt)})
- Contain valid JSON with "name" and "arguments" fields
- Use real tool parameter names (see the tool list)

## Anti-examples (NEVER do this)

DO NOT describe the tool call in prose. DO NOT write \`I'll use the create_text tool to make...\` — just emit the block.
DO NOT wrap the JSON in markdown code fences unless using \`\`\`tool_code or \`\`\`json (the parser supports those too, but the wrapper above is preferred).
DO NOT invent tools that are not in the list below.

## Tool list

${toolList}

## How tool execution works

1. You emit a tool-call block.
2. The system pauses your output, runs the tool, and feeds the result back to you in the next turn.
3. You then either call another tool, or give the user your final answer in plain prose.

If a tool call returns \`{"ok": true, "file": {...}}\`, the file has been created and is downloadable by the user — just confirm what was made. If it returns \`{"ok": false, "error": "..."}\`, explain to the user what went wrong.
`;
}

function wrapperHint(fmt: ToolFormat): string {
  switch (fmt) {
    case "function_call": return "<function_call>...</function_call>";
    case "tool_code": return "```tool_code ... ```";
    case "json_block": return "```json ... ```";
    case "tool_call":
    default: return "<tool_call>...</tool_call>";
  }
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 140);
}

/**
 * Reasonable example args for the well-known tool ids.
 * Used in the prompt example so the model sees a complete realistic call.
 */
function defaultArgsFor(toolId: string): Record<string, unknown> {
  switch (toolId) {
    case "create_text": return { filename: "notes.txt", content: "Hello world" };
    case "create_pdf": return { filename: "report.pdf", title: "Quarterly Report", content: "..." };
    case "create_markdown": return { filename: "README.md", content: "# Project" };
    case "search_web": return { query: "claude code release notes", limit: 5 };
    case "fetch_url": return { url: "https://example.com" };
    case "calculate": return { expression: "(2 + 3) * 4" };
    case "read_file": return { path: "src/index.ts" };
    case "write_file": return { path: "src/new.ts", content: "export const x = 1;" };
    case "run_command": return { command: "ls -la" };
    default: return { /* fill in with your real args */ };
  }
}
