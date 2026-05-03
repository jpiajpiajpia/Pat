import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import path from "path";
import { prisma } from "@/lib/prisma";
import { callMcpTool } from "@/lib/mcp";
import { searchMemories } from "@/lib/memoryStore";
import { TOOL_CATALOG } from "@/lib/tools/registry";
import { saveGeneratedFile } from "@/lib/tools/storage";
import { buildToolPrompt } from "@/lib/prompts/toolPrompt";
import { createAgentStreamResponse } from "@/lib/agentResponseStream";
import { getSkillsByIds, renderSkillsBlock } from "@/lib/skills";
import type { AgentTool } from "@/lib/agentLoop";
import type { CoreMessage } from "ai";

const ollama = createOpenAI({
  baseURL: `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/v1`,
  apiKey: "ollama",
});

export async function POST(req: Request) {
  const { messages, conversationId, userId, model, fileIds, skillIds, mcpHints } = await req.json();

  // ---------- Resolve model + settings ----------
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const modelName: string =
    (typeof model === "string" && model) || settings?.defaultChatModel || "mistral:7b";

  // ---------- Build the agent tool set ----------
  const tools: Record<string, AgentTool> = {};

  // Built-in catalog tools
  const enabledToolIds: Set<string> | null = settings?.enabledTools
    ? new Set(JSON.parse(settings.enabledTools) as string[])
    : null;

  for (const t of TOOL_CATALOG) {
    if (enabledToolIds && !enabledToolIds.has(t.id)) continue;
    tools[t.id] = {
      name: t.id,
      description: t.description,
      execute: async (args) => {
        try {
          // Validate args via the tool's zod schema (if any). Bad args from
          // the model become a clear error rather than a runtime crash.
          const parsedArgs = t.parameters ? t.parameters.parse(args) : args;
          const result = await t.execute(parsedArgs as Record<string, unknown>, { conversationId, userId });
          return result;
        } catch (err) {
          return { ok: false, error: `Tool ${t.id} failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  // MCP server tools
  if (userId) {
    const mcpServers = await prisma.mcpServer.findMany({ where: { userId, enabled: true } });
    for (const server of mcpServers) {
      if (!server.tools) continue;
      const serverTools = JSON.parse(server.tools) as Array<{
        name: string;
        description: string;
        inputSchema: { properties?: Record<string, { type: string; description?: string }> };
      }>;
      for (const t of serverTools) {
        const toolId = `${server.name.replace(/\W+/g, "_")}_${t.name}`;
        tools[toolId] = {
          name: toolId,
          description: `[${server.name}] ${t.description}`,
          execute: async (args) => {
            try {
              return await callMcpTool(server.url, server.authType, server.authValue, t.name, args);
            } catch (err) {
              return { ok: false, error: String(err) };
            }
          },
        };
      }
    }
  }

  // ---------- Memory retrieval + system prompt ----------
  const lastUserMessage = [...messages]
    .reverse()
    .find((m: { role: string }) => m.role === "user") as { content: string } | undefined;

  const basePrompt =
    settings?.systemPrompt ??
    "You are Pat, a helpful local AI assistant. Be concise, accurate, and professional.";

  let memorySection = "";
  let memoryHits = 0;
  if (lastUserMessage?.content) {
    try {
      const memories = await searchMemories(userId, lastUserMessage.content, 5, 0.4);
      memoryHits = memories.length;
      if (memories.length > 0) {
        memorySection = "\n\n## Relevant context from memory\n" + memories.map((m) => `- ${m.content}`).join("\n");
      }
    } catch {
      // Memory unavailable — keep going
    }
  }

  // Attached file context + the read_attached_file tool.
  // We fetch uploads once and use them for both:
  //   (a) the system-prompt summary (so context is immediately accessible)
  //   (b) the read_attached_file tool (so the model has an explicit, callable path
  //       — small local models often prefer calling tools to reading prompt context)
  let fileSection = "";
  const uploads = (Array.isArray(fileIds) && fileIds.length > 0)
    ? await prisma.upload.findMany({ where: { id: { in: fileIds as string[] } } })
    : [];

  if (uploads.length > 0) {
    const blocks: string[] = [];
    for (const u of uploads) {
      const header = `### ${u.filename} (${u.mimeType}, ${formatBytes(u.sizeBytes)})`;
      if (u.textContent && u.textContent.length > 0) {
        blocks.push(`${header}\n\`\`\`\n${u.textContent}\n\`\`\``);
      } else {
        blocks.push(
          `${header}\n` +
          `*[Attached but text could not be extracted. If image/video/audio you cannot view it. ` +
          `If a PDF, extraction failed (likely scanned/encrypted). Acknowledge and ask the user what to do.]*`
        );
      }
    }
    fileSection =
      "\n\n## Attached files (already extracted — use this content directly)\n\n" +
      blocks.join("\n\n") +
      "\n\n**Important:** the text above is the FULL extracted content of the user's attachments. " +
      "When the user asks you to summarize, analyze, quote, or answer questions about an attached file, " +
      "respond directly using that content — DO NOT call any tool to 're-extract' or 'process' the file. " +
      "If you want to give the user a downloadable copy of the extracted text, call read_attached_file(filename).";

    // Register read_attached_file: returns the cached extracted text + saves a downloadable .txt
    tools["read_attached_file"] = {
      name: "read_attached_file",
      description:
        "Open an attached file and return its full extracted text. Also saves the extracted text as a downloadable .txt file the user can review. Use this when the user wants a downloadable copy of the extracted text, or as a way to confirm what content you're working with. Argument: filename (the exact filename the user attached, e.g. 'report.pdf').",
      execute: async (args) => {
        const schema = z.object({ filename: z.string() });
        let parsed: { filename: string };
        try { parsed = schema.parse(args); }
        catch (err) { return { ok: false, error: `Invalid args: ${err instanceof Error ? err.message : String(err)}` }; }

        const upload = uploads.find((u) => u.filename === parsed.filename);
        if (!upload) {
          return {
            ok: false,
            error: `No attached file named "${parsed.filename}". Attached: ${uploads.map((u) => u.filename).join(", ")}`,
          };
        }
        if (!upload.textContent) {
          return {
            ok: false,
            error: `"${parsed.filename}" was attached but no text could be extracted. Tell the user the file appears to be unreadable (binary, scanned without OCR, or encrypted).`,
          };
        }

        // Save the extracted text as a downloadable .txt for the user to inspect
        const baseName = path.parse(upload.filename).name;
        const txtName = `${baseName}_extracted.txt`;
        const file = await saveGeneratedFile({
          conversationId,
          filename: txtName,
          mimeType: "text/plain",
          toolName: "read_attached_file",
          content: upload.textContent,
        });

        return {
          ok: true,
          file,
          text: upload.textContent,
          message: `Extracted ${upload.textContent.length} characters from ${upload.filename}. The user can download ${txtName}. Now use the text above to answer their question.`,
        };
      },
    };
  }

  // ---------- Active skills (injected as a system-prompt section) ----------
  let skillsSection = "";
  if (Array.isArray(skillIds) && skillIds.length > 0) {
    try {
      const activeSkills = await getSkillsByIds(skillIds as string[]);
      skillsSection = renderSkillsBlock(activeSkills);
    } catch {
      // skip skills on failure rather than break the chat
    }
  }

  // ---------- MCP hints (the user clicked one or more MCP chips in the + menu) ----------
  let mcpHintsSection = "";
  if (Array.isArray(mcpHints) && mcpHints.length > 0) {
    const names = (mcpHints as Array<{ name?: string }>)
      .map((m) => m.name)
      .filter(Boolean);
    if (names.length > 0) {
      mcpHintsSection =
        "\n\n## Preferred tool servers\n\nThe user has indicated you should prefer using tools from these MCP server(s) when relevant: " +
        names.map((n) => `**${n}**`).join(", ") +
        ". Their tools are already loaded and named with the server prefix; reach for them when the task fits.";
    }
  }

  // Build tool instruction block (this is the key fix: explicit format teaching)
  const toolPromptBlock = buildToolPrompt(
    modelName,
    Object.values(tools).map((t) => ({ id: t.name, description: t.description })),
  );

  const systemPrompt = `${basePrompt}${memorySection}${fileSection}${skillsSection}${mcpHintsSection}${toolPromptBlock}`;

  // ---------- Run the agent loop and stream the response ----------
  return createAgentStreamResponse(
    {
      model: ollama(modelName),
      systemPrompt,
      messages: messages as CoreMessage[],
      tools,
      maxSteps: 5,
    },
    {
      initialAnnotations: [
        { type: "phase", step: "preparing", text: "Preparing tools…", t: 0 },
        { type: "phase", step: "tools_loaded", text: `${Object.keys(tools).length} tools available`, t: 0 },
        { type: "phase", step: "memory_done", text: memoryHits > 0 ? `Found ${memoryHits} relevant ${memoryHits === 1 ? "memory" : "memories"}` : "No relevant memories", count: memoryHits, t: 0 },
        { type: "phase", step: "thinking", text: `Querying ${modelName}…`, model: modelName, t: 0 },
      ],
      onComplete: async (text) => {
        if (!conversationId) return;
        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (conv?.title === "New conversation" && lastUserMessage) {
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { title: lastUserMessage.content.slice(0, 60) },
          });
        }
        await prisma.message.create({
          data: { conversationId, role: "assistant", content: text || "(used tools)" },
        });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      },
    },
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

