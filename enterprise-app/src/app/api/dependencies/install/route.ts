import { NextRequest } from "next/server";

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

export async function POST(req: NextRequest) {
  const { model } = await req.json();
  if (!model || typeof model !== "string") {
    return new Response(JSON.stringify({ error: "model required" }), { status: 400 });
  }

  // Ollama's /api/pull returns a stream of JSON lines with progress
  const ollamaRes = await fetch(`${OLLAMA_BASE}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: true }),
  });

  if (!ollamaRes.ok || !ollamaRes.body) {
    return new Response(
      JSON.stringify({ error: `Failed to start pull: ${ollamaRes.status}` }),
      { status: 502 }
    );
  }

  // Forward Ollama's NDJSON stream straight through to the client
  const stream = new ReadableStream({
    async start(controller) {
      const reader = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) controller.enqueue(new TextEncoder().encode(line + "\n"));
          }
        }
        if (buffer.trim()) controller.enqueue(new TextEncoder().encode(buffer + "\n"));
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify({ error: String(err) }) + "\n")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
