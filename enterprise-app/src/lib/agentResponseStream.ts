import type { AgentEvent } from "./agentLoop";
import { runAgentLoop, type AgentLoopOptions } from "./agentLoop";

/**
 * Wrap the agent loop in a Vercel AI SDK data stream Response.
 *
 * The data stream protocol uses these prefixes (so `useChat` can decode):
 *   0:"text\n"           — text delta
 *   2:[{...}]            — generic data
 *   3:"error"            — error
 *   8:[{annotation}]     — message annotations
 *   9:{tool call}        — tool call (toolCallId, toolName, args)
 *   a:{tool result}      — tool result (toolCallId, result)
 *   d:{finish}           — finish_message
 *
 * We use 0/8 only — tool calls/results are conveyed as annotations so the
 * existing ActivityFeed component picks them up without special tool-invocation
 * machinery (which only works for natively-emitted OpenAI-format calls).
 */
export interface AgentStreamHooks {
  /** Called once with the assembled assistant text (cleaned, without tool-call markup) */
  onComplete?: (assembledText: string, toolCallsRun: number) => Promise<void> | void;
  /** Called for each tool call as it happens (for persistence / activity feed) */
  onToolCall?: (e: { id: string; name: string; args: Record<string, unknown> }) => void;
  onToolResult?: (e: { id: string; name: string; result: unknown; ok: boolean }) => void;
  /** Initial annotations to emit before the loop starts (e.g. memory hits, model name) */
  initialAnnotations?: Record<string, unknown>[];
}

export function createAgentStreamResponse(
  loopOpts: AgentLoopOptions,
  hooks: AgentStreamHooks = {},
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: string) => controller.enqueue(encoder.encode(line));
      const sendText = (text: string) => send(`0:${JSON.stringify(text)}\n`);
      const sendAnno = (anno: Record<string, unknown>) => send(`8:${JSON.stringify([anno])}\n`);
      const sendError = (msg: string) => send(`3:${JSON.stringify(msg)}\n`);

      // Replay initial annotations
      for (const anno of hooks.initialAnnotations ?? []) {
        sendAnno(anno);
      }

      let assembledText = "";
      let totalToolCalls = 0;

      try {
        for await (const event of runAgentLoop(loopOpts) as AsyncGenerator<AgentEvent>) {
          switch (event.type) {
            case "text":
              if (event.text) {
                sendText(event.text);
                assembledText += event.text;
              }
              break;
            case "tool_call":
              sendAnno({ type: "tool_start", toolName: event.name, toolCallId: event.id, args: event.args });
              hooks.onToolCall?.({ id: event.id, name: event.name, args: event.args });
              totalToolCalls++;
              break;
            case "tool_result": {
              const ann: Record<string, unknown> = {
                type: "tool_done",
                toolName: event.name,
                toolCallId: event.id,
                ok: event.ok,
              };
              // If the tool produced a downloadable file, include its info so MessageBubble can render a download chip
              const r = event.result as { file?: { id?: string; filename?: string; sizeBytes?: number; mimeType?: string; downloadUrl?: string }; error?: string } | undefined;
              if (r?.file) {
                ann.file = r.file;
              }
              if (!event.ok && r?.error) {
                ann.error = r.error;
              }
              sendAnno(ann);
              hooks.onToolResult?.({ id: event.id, name: event.name, result: event.result, ok: event.ok });
              break;
            }
            case "step_start":
              sendAnno({ type: "phase", step: "step_start", stepIndex: event.step });
              break;
            case "step_end":
              sendAnno({ type: "phase", step: "step_end", stepIndex: event.step, toolCallsRun: event.toolCallsRun });
              break;
            case "done":
              if (event.reason === "error" && event.error) {
                sendError(event.error);
              }
              sendAnno({ type: "phase", step: "done", reason: event.reason });
              break;
          }
        }
      } catch (err) {
        sendError(String(err));
      }

      // Tail annotation + finish
      try {
        await hooks.onComplete?.(assembledText, totalToolCalls);
      } catch {
        // Don't fail the stream on persistence errors
      }
      send(`d:${JSON.stringify({ finishReason: "stop" })}\n`);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": "v1",
    },
  });
}
