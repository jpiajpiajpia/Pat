/**
 * Per-model capability hints. Used by the agent loop to tailor:
 *  - the tool-call format we teach the model in the system prompt
 *  - the parser's pattern priority
 *  - reasoning-block detection
 */

export type ToolFormat = "tool_call" | "function_call" | "tool_code" | "json_block";

export interface ModelCapabilities {
  /** Which tool format this model emits most reliably */
  toolFormat: ToolFormat;
  /** Whether the model emits <think>...</think> reasoning blocks */
  emitsThinking: boolean;
  /** Whether tool calling has been observed to work reliably with this model */
  toolReliability: "high" | "medium" | "low";
}

const DEFAULTS: ModelCapabilities = {
  toolFormat: "tool_call",
  emitsThinking: false,
  toolReliability: "medium",
};

const RULES: Array<{ match: RegExp; caps: Partial<ModelCapabilities> }> = [
  // Qwen family: <tool_call> tags, generally reliable on 14B+
  { match: /^qwen2?\.?5/i, caps: { toolFormat: "tool_call", toolReliability: "high" } },
  { match: /^qwen2?\.?5-coder/i, caps: { toolFormat: "tool_call", toolReliability: "high" } },
  // DeepSeek R1: emits <think> blocks
  { match: /^deepseek-r1/i, caps: { toolFormat: "tool_call", emitsThinking: true, toolReliability: "medium" } },
  { match: /^deepseek-coder/i, caps: { toolFormat: "tool_call", toolReliability: "high" } },
  // Llama: <function_call>
  { match: /^llama3/i, caps: { toolFormat: "function_call", toolReliability: "medium" } },
  // Mistral: native tool_calls work, but <tool_call> as text fallback also works
  { match: /^mistral/i, caps: { toolFormat: "tool_call", toolReliability: "high" } },
  { match: /^mixtral/i, caps: { toolFormat: "function_call", toolReliability: "high" } },
  // Gemma: ```tool_code blocks
  { match: /^gemma/i, caps: { toolFormat: "tool_code", toolReliability: "medium" } },
  // Phi: tool_call generally works
  { match: /^phi/i, caps: { toolFormat: "tool_call", toolReliability: "medium" } },
];

export function getModelCapabilities(modelId: string): ModelCapabilities {
  for (const rule of RULES) {
    if (rule.match.test(modelId)) {
      return { ...DEFAULTS, ...rule.caps };
    }
  }
  return DEFAULTS;
}

/**
 * Render a tool-format example for the system prompt, tailored to the model.
 */
export function exampleToolCall(format: ToolFormat, name: string, args: Record<string, unknown>): string {
  const json = JSON.stringify({ name, arguments: args }, null, 2);
  switch (format) {
    case "function_call":
      return `<function_call>\n${json}\n</function_call>`;
    case "tool_code":
      return "```tool_code\n" + json + "\n```";
    case "json_block":
      return "```json\n" + json + "\n```";
    case "tool_call":
    default:
      return `<tool_call>\n${json}\n</tool_call>`;
  }
}
