/**
 * Tool-call parser for local-model output.
 *
 * Local models (Qwen, Llama, Gemma, etc.) emit tool calls as text rather than
 * the OpenAI structured `tool_calls` field. This parser handles all common
 * formats and extracts a normalized list of calls + the cleaned text.
 *
 * Patterns handled:
 *   <tool_call>{...}</tool_call>             — Qwen, Hermes, Mistral fine-tunes
 *   <function_call>{...}</function_call>     — Llama, Mixtral
 *   ```tool_code\n{...}\n```                 — Gemma
 *   ```json\n{"name": ..., ...}\n```         — generic
 *   {"name": ..., "arguments": {...}}\n</tool_call>  — malformed (Qwen leak)
 *   {"name": ..., "arguments": {...}} (bare) — last-resort
 */

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ParseResult {
  cleanText: string;
  toolCalls: ParsedToolCall[];
}

const PATTERNS: Array<{ regex: RegExp; description: string }> = [
  // Properly wrapped <tool_call>...</tool_call>
  { regex: /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g, description: "tool_call tag" },
  // Properly wrapped <function_call>...</function_call>
  { regex: /<function_call>\s*([\s\S]*?)\s*<\/function_call>/g, description: "function_call tag" },
  // Gemma's ```tool_code block
  { regex: /```tool_code\s*\n([\s\S]*?)\n\s*```/g, description: "tool_code block" },
  // Generic ```json block containing a tool call shape
  { regex: /```json\s*\n(\{[\s\S]*?"name"[\s\S]*?"(?:arguments|parameters)"[\s\S]*?\})\s*\n\s*```/g, description: "json block" },
  // The exact malformed pattern observed in our DB:
  //    {"name": "...", "arguments": {...}}\n</tool_call>
  // (closing tag with no opening tag, JSON is a complete object)
  { regex: /(\{(?:[^{}]|\{[^{}]*\})*"name"(?:[^{}]|\{[^{}]*\})*"(?:arguments|parameters)"(?:[^{}]|\{[^{}]*\})*\})\s*<\/tool_call>/g, description: "orphan close tag" },
];

/**
 * Last-resort parser: scan for bare `{"name": "...", "arguments": {...}}` blocks.
 * Only used when no other pattern matched (to avoid eating legitimate JSON in chat).
 */
function lastResortParse(text: string): ParseResult {
  const toolCalls: ParsedToolCall[] = [];
  let cleanText = text;

  // Find balanced JSON objects starting with `{"name"`
  let searchFrom = 0;
  while (searchFrom < cleanText.length) {
    const start = cleanText.indexOf('{"name"', searchFrom);
    if (start === -1) break;

    // Walk forward tracking brace depth
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = start; i < cleanText.length; i++) {
      const c = cleanText[i];
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }

    if (end === -1) break; // incomplete JSON, leave it
    const candidate = cleanText.slice(start, end);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && typeof parsed.name === "string") {
        const args = (parsed.arguments ?? parsed.parameters ?? {}) as Record<string, unknown>;
        toolCalls.push({ name: parsed.name, arguments: args });
        // Strip from cleanText
        cleanText = cleanText.slice(0, start) + cleanText.slice(end);
        searchFrom = start;
        continue;
      }
    } catch {
      // Not valid JSON, skip past it
    }
    searchFrom = end;
  }

  return { cleanText, toolCalls };
}

export function parseToolCalls(text: string): ParseResult {
  let cleanText = text;
  const toolCalls: ParsedToolCall[] = [];

  for (const { regex } of PATTERNS) {
    cleanText = cleanText.replace(regex, (match, jsonStr: string) => {
      const candidate = jsonStr.trim();
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && typeof parsed.name === "string") {
          const args = (parsed.arguments ?? parsed.parameters ?? {}) as Record<string, unknown>;
          toolCalls.push({ name: parsed.name, arguments: args });
          return ""; // strip
        }
      } catch {
        // Couldn't parse JSON — leave the original text in place
      }
      return match;
    });
  }

  // If no patterns matched, try the last-resort scan
  if (toolCalls.length === 0) {
    const fallback = lastResortParse(cleanText);
    return fallback;
  }

  // Also strip any orphan </tool_call> tags left behind
  cleanText = cleanText.replace(/<\/?(?:tool_call|function_call)>/g, "");

  // Strip stray model artifacts (Chinese leaked tokens, leading/trailing whitespace)
  cleanText = cleanText.replace(/^[一-鿿]+/g, "").trim();

  return { cleanText, toolCalls };
}

/**
 * Heuristic: does this chunk *possibly* contain the start of a tool call marker?
 * Used to decide whether to buffer streaming output until we have more context.
 */
export function looksLikeToolCallStart(text: string): boolean {
  // Check the trailing portion for partial markers
  const tail = text.slice(-40);
  return (
    tail.includes("<tool") ||
    tail.includes("<function") ||
    tail.includes("```tool_code") ||
    tail.includes("```json") ||
    /\{"name"\s*:/.test(tail)
  );
}
