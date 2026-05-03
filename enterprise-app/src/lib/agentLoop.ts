import { streamText, type CoreMessage, type LanguageModel } from "ai";
import { parseToolCalls, looksLikeToolCallStart } from "./toolCallParser";

export interface AgentTool {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentLoopOptions {
  model: LanguageModel;
  systemPrompt: string;
  messages: CoreMessage[];
  tools: Record<string, AgentTool>;
  maxSteps?: number;
}

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: unknown; ok: boolean }
  | { type: "step_start"; step: number }
  | { type: "step_end"; step: number; toolCallsRun: number }
  | { type: "done"; reason: "no_tool_calls" | "max_steps" | "error"; error?: string };

/**
 * Multi-step agent loop with text-based tool-call parsing for local models.
 *
 * Yields events as they happen. Caller is responsible for forwarding text
 * events to the client stream and tool events as annotations.
 *
 * The loop:
 *   1. Calls the model with the current conversation
 *   2. Streams text, buffering small windows to avoid emitting partial tool-call markers
 *   3. After each round completes, parses the full text for tool calls
 *   4. If found: executes them, appends results to the conversation, loops
 *   5. If not found: emits remaining buffer and ends
 */
export async function* runAgentLoop(opts: AgentLoopOptions): AsyncGenerator<AgentEvent> {
  const conversation: CoreMessage[] = [...opts.messages];
  const maxSteps = opts.maxSteps ?? 5;
  let toolCallCounter = 0;

  for (let step = 0; step < maxSteps; step++) {
    yield { type: "step_start", step };

    let fullText = "";
    let pendingBuffer = "";

    try {
      const result = await streamText({
        model: opts.model,
        system: opts.systemPrompt,
        messages: conversation,
      });

      for await (const chunk of result.textStream) {
        fullText += chunk;
        pendingBuffer += chunk;

        // Decide what's safe to emit: everything before any potential tool-call marker.
        // We keep a small trailing buffer so partial markers don't leak through.
        const KEEP_TAIL = 40;

        // Look for a definite marker start
        const markerIdx = pendingBuffer.search(/<tool_call>|<function_call>|```tool_code|```json|<\/tool_call>/);

        if (markerIdx === -1) {
          // No marker found — emit everything except the last KEEP_TAIL chars
          // (in case the very next chunk completes a marker)
          if (pendingBuffer.length > KEEP_TAIL) {
            const emitNow = pendingBuffer.slice(0, -KEEP_TAIL);
            if (!looksLikeToolCallStart(emitNow)) {
              yield { type: "text", text: emitNow };
              pendingBuffer = pendingBuffer.slice(-KEEP_TAIL);
            }
          }
        } else if (markerIdx > 0) {
          // Marker found mid-buffer — emit everything before it, then keep marker buffered
          const before = pendingBuffer.slice(0, markerIdx);
          if (before) yield { type: "text", text: before };
          pendingBuffer = pendingBuffer.slice(markerIdx);
        }
        // else: marker at start, keep buffering until we have the full block
      }
    } catch (err) {
      yield { type: "done", reason: "error", error: String(err) };
      return;
    }

    // Parse the full round's text for tool calls
    const { cleanText, toolCalls } = parseToolCalls(fullText);

    // Compute the leftover text we haven't emitted yet from pendingBuffer
    // (we need to re-parse the buffer in case it contained tool calls)
    const buffered = parseToolCalls(pendingBuffer);

    if (toolCalls.length === 0) {
      // No tool calls — emit the remaining buffer and finish
      if (buffered.cleanText) yield { type: "text", text: buffered.cleanText };
      yield { type: "step_end", step, toolCallsRun: 0 };
      yield { type: "done", reason: "no_tool_calls" };
      return;
    }

    // Tool calls found — execute them
    // Note: we don't emit the leftover buffer text because it likely contains
    // the tool-call JSON we already extracted.
    const toolResults: Array<{ name: string; args: Record<string, unknown>; result: unknown; ok: boolean }> = [];

    for (const call of toolCalls) {
      const id = `call_${++toolCallCounter}`;
      yield { type: "tool_call", id, name: call.name, args: call.arguments };

      const tool = opts.tools[call.name];
      if (!tool) {
        const result = { ok: false, error: `Unknown tool: ${call.name}. Available: ${Object.keys(opts.tools).join(", ")}` };
        yield { type: "tool_result", id, name: call.name, result, ok: false };
        toolResults.push({ name: call.name, args: call.arguments, result, ok: false });
        continue;
      }

      try {
        const result = await tool.execute(call.arguments);
        const ok = !(result && typeof result === "object" && (result as { error?: unknown; ok?: unknown }).error !== undefined && (result as { ok?: unknown }).ok === false);
        yield { type: "tool_result", id, name: call.name, result, ok };
        toolResults.push({ name: call.name, args: call.arguments, result, ok });
      } catch (err) {
        const result = { ok: false, error: String(err) };
        yield { type: "tool_result", id, name: call.name, result, ok: false };
        toolResults.push({ name: call.name, args: call.arguments, result, ok: false });
      }
    }

    yield { type: "step_end", step, toolCallsRun: toolCalls.length };

    // Build the next-turn input with tool results
    conversation.push({ role: "assistant", content: cleanText || "(used tools)" });

    const resultBlock = toolResults
      .map((r) => `Tool: ${r.name}\nArguments: ${JSON.stringify(r.args)}\nResult: ${stringify(r.result)}`)
      .join("\n\n");

    conversation.push({
      role: "user",
      content:
        `[System: tool execution results — these are the actual outputs of the tools you called. Use them to answer the user.]\n\n${resultBlock}\n\nIf the task is complete, respond directly to the user with a brief confirmation. If you need more information, call additional tools.`,
    });
  }

  yield { type: "done", reason: "max_steps" };
}

function stringify(v: unknown, maxLen = 4000): string {
  let s: string;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (s.length > maxLen) s = s.slice(0, maxLen) + `… (${s.length - maxLen} chars truncated)`;
  return s;
}
