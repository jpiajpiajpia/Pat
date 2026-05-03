import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TOOL_CATALOG } from "@/lib/tools/registry";
import { callMcpTool } from "@/lib/mcp";
import { buildToolPrompt } from "@/lib/prompts/toolPrompt";
import { createAgentStreamResponse } from "@/lib/agentResponseStream";
import type { AgentTool } from "@/lib/agentLoop";
import type { CoreMessage } from "ai";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { glob } from "glob";

const execAsync = promisify(exec);

const ollama = createOpenAI({
  baseURL: `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/v1`,
  apiKey: "ollama",
});

function safePath(workspace: string, rel: string): string | null {
  const abs = path.resolve(workspace, rel);
  if (!abs.startsWith(path.resolve(workspace))) return null;
  return abs;
}

const CODE_SYSTEM = `You are Pat's code agent — an expert software engineer that works directly on the user's local files.

You have a workspace folder mapped on disk and a rich tool set: read/write/edit/glob files, search code with line numbers, run shell commands, inspect git, and generate documents.

How to work:
1. Understand the task. If unclear, ask one focused question first.
2. Explore before acting — list_directory, code_search, file_exists.
3. Make targeted, minimal edits. Use edit_file (find/replace) before write_file (full overwrite).
4. After changes, verify by reading the file back.
5. When you're done, summarize what changed in 1–3 sentences.

Be transparent. If a tool fails, explain why and try a different approach.
`;

export async function POST(req: Request) {
  const { sessionId, task, workspace, model } = await req.json();

  if (!sessionId || !task) {
    return new Response(JSON.stringify({ error: "sessionId and task required" }), { status: 400 });
  }

  const session = await prisma.codeSession.findUnique({ where: { id: sessionId } });
  const userSettings = session
    ? await prisma.userSettings.findUnique({ where: { userId: session.userId } })
    : null;
  const modelName: string =
    (typeof model === "string" && model) || userSettings?.defaultCodeModel || "qwen2.5-coder:7b";

  const ws = workspace || process.cwd();

  await prisma.codeSession.update({
    where: { id: sessionId },
    data: { status: "running", workspace: ws, title: task.slice(0, 60), updatedAt: new Date() },
  });

  async function saveStep(type: string, content: string, toolName?: string) {
    await prisma.codeStep.create({ data: { sessionId, type, content, toolName } });
  }

  // ---------- Workspace tools (file ops, shell, git, search) ----------
  const tools: Record<string, AgentTool> = {};

  const declare = (
    name: string,
    description: string,
    schema: z.ZodObject<z.ZodRawShape>,
    fn: (args: Record<string, unknown>) => Promise<unknown>,
  ) => {
    tools[name] = {
      name,
      description,
      execute: async (rawArgs) => {
        let args: Record<string, unknown>;
        try {
          args = schema.parse(rawArgs) as Record<string, unknown>;
        } catch (err) {
          return { ok: false, error: `Invalid arguments for ${name}: ${err instanceof Error ? err.message : String(err)}` };
        }
        try {
          return await fn(args);
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    };
  };

  declare(
    "read_file",
    "Read the contents of a file in the workspace.",
    z.object({ path: z.string().describe("Path relative to workspace root") }),
    async ({ path: relPath }) => {
      const abs = safePath(ws, relPath as string);
      if (!abs) return { ok: false, error: "Path traversal denied" };
      const content = await fs.readFile(abs, "utf-8");
      await saveStep("tool_result", `Read ${relPath} (${content.length} chars)`, "read_file");
      return { ok: true, content };
    },
  );

  declare(
    "write_file",
    "Write or create a file. Creates parent directories automatically.",
    z.object({
      path: z.string().describe("Path relative to workspace root"),
      content: z.string().describe("Full file content to write"),
    }),
    async ({ path: relPath, content }) => {
      const abs = safePath(ws, relPath as string);
      if (!abs) return { ok: false, error: "Path traversal denied" };
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content as string, "utf-8");
      await saveStep("tool_result", `Wrote ${relPath} (${(content as string).length} chars)`, "write_file");
      return { ok: true, path: relPath };
    },
  );

  declare(
    "edit_file",
    "Make a targeted string replacement in an existing file. Fails if old_string is not found.",
    z.object({
      path: z.string().describe("Path relative to workspace root"),
      old_string: z.string(),
      new_string: z.string(),
    }),
    async ({ path: relPath, old_string, new_string }) => {
      const abs = safePath(ws, relPath as string);
      if (!abs) return { ok: false, error: "Path traversal denied" };
      const current = await fs.readFile(abs, "utf-8");
      if (!current.includes(old_string as string)) {
        return { ok: false, error: `old_string not found in ${relPath}` };
      }
      const updated = current.replace(old_string as string, new_string as string);
      await fs.writeFile(abs, updated, "utf-8");
      await saveStep("tool_result", `Edited ${relPath}`, "edit_file");
      return { ok: true };
    },
  );

  declare(
    "list_directory",
    "List files and directories at a path within the workspace. Use '.' for root.",
    z.object({ path: z.string().default(".") }),
    async ({ path: relPath }) => {
      const abs = safePath(ws, (relPath as string) || ".");
      if (!abs) return { ok: false, error: "Path traversal denied" };
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const result = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : "file",
        path: path.join(relPath as string, e.name),
      }));
      await saveStep("tool_result", `Listed ${relPath} — ${result.length} entries`, "list_directory");
      return { ok: true, entries: result };
    },
  );

  declare(
    "create_directory",
    "Create a directory (and any missing parents).",
    z.object({ path: z.string() }),
    async ({ path: relPath }) => {
      const abs = safePath(ws, relPath as string);
      if (!abs) return { ok: false, error: "Path traversal denied" };
      await fs.mkdir(abs, { recursive: true });
      await saveStep("tool_result", `Created directory ${relPath}`, "create_directory");
      return { ok: true };
    },
  );

  declare(
    "file_exists",
    "Check whether a file or directory exists.",
    z.object({ path: z.string() }),
    async ({ path: relPath }) => {
      const abs = safePath(ws, relPath as string);
      if (!abs) return { ok: false, error: "Path traversal denied" };
      return { ok: true, exists: existsSync(abs) };
    },
  );

  declare(
    "glob_find",
    "Find files matching a glob pattern (e.g. '**/*.ts'). Excludes node_modules, .next, .git.",
    z.object({ pattern: z.string() }),
    async ({ pattern }) => {
      const files = await glob(pattern as string, {
        cwd: ws,
        ignore: ["node_modules/**", ".next/**", ".git/**", "dist/**", "build/**"],
      });
      await saveStep("tool_result", `Glob ${pattern} → ${files.length} files`, "glob_find");
      return { ok: true, files };
    },
  );

  declare(
    "code_search",
    "Search file contents and return matches with line numbers + surrounding context. Use this for code review and finding usages.",
    z.object({
      query: z.string(),
      glob: z.string().default(""),
      context_lines: z.number().int().min(0).max(10).default(2),
      max_matches: z.number().int().min(1).max(200).default(50),
    }),
    async ({ query, glob: globPattern, context_lines, max_matches }) => {
      const includes = (globPattern as string)
        ? `--include="${(globPattern as string).replace(/"/g, '\\"')}"`
        : '--include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.rs" --include="*.java" --include="*.rb" --include="*.php" --include="*.json" --include="*.md" --include="*.yaml" --include="*.yml"';
      const cmd = `grep -rn -C${context_lines} ${includes} --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=dist --exclude-dir=build "${(query as string).replace(/"/g, '\\"')}" .`;
      const { stdout } = await execAsync(cmd, { cwd: ws, timeout: 15000, maxBuffer: 1024 * 1024 * 4 })
        .catch((e: { stdout?: string }) => ({ stdout: e.stdout ?? "" }));
      const lines = stdout.split("\n").filter(Boolean).slice(0, (max_matches as number) * ((context_lines as number) * 2 + 2));
      await saveStep("tool_result", `code_search "${query}" — ${lines.length} lines`, "code_search");
      return { ok: true, matches: lines, query, glob: (globPattern as string) || "(all source files)" };
    },
  );

  declare(
    "run_command",
    "Run a shell command in the workspace directory. Use for npm install, run tests, lint, build, git, etc.",
    z.object({
      command: z.string(),
      timeout_ms: z.number().int().min(100).max(120000).default(30000),
    }),
    async ({ command, timeout_ms }) => {
      const BLOCKED = [/rm\s+-rf\s+\//, /mkfs/, /dd\s+if=/, /:\(\)\{.*\}/, /chmod\s+777\s+\//];
      if (BLOCKED.some((p) => p.test(command as string))) {
        return { ok: false, error: "Command blocked: potentially destructive" };
      }
      await saveStep("tool_call", `$ ${command}`, "run_command");
      try {
        const { stdout, stderr } = await execAsync(command as string, {
          cwd: ws,
          timeout: timeout_ms as number,
          maxBuffer: 1024 * 1024 * 4,
        });
        const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
        await saveStep("tool_result", output || "(no output)", "run_command");
        return { ok: true, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
        const output = [e.stdout?.trim(), e.stderr?.trim()].filter(Boolean).join("\n") || e.message;
        await saveStep("tool_result", `Error: ${output}`, "run_command");
        return { ok: false, stdout: e.stdout?.trim() ?? "", stderr: e.stderr?.trim() ?? e.message ?? "", exitCode: e.code ?? 1 };
      }
    },
  );

  declare(
    "git_status",
    "Show the working tree status (staged, unstaged, untracked files). Use for code review and change summaries.",
    z.object({}),
    async () => {
      const { stdout } = await execAsync("git status --porcelain=v1 -b", { cwd: ws, timeout: 5000 });
      const lines = stdout.trim().split("\n");
      const branch = lines[0]?.replace(/^##\s*/, "") ?? "";
      const files = lines.slice(1).map((l) => ({ status: l.slice(0, 2), path: l.slice(3) }));
      await saveStep("tool_result", `git_status — branch ${branch}, ${files.length} changes`, "git_status");
      return { ok: true, branch, files, summary: stdout.trim() || "Working tree clean" };
    },
  );

  declare(
    "git_diff",
    "Show the diff for the workspace, a single file, or a commit range. staged: true = staged changes; ref = compare against branch/commit.",
    z.object({
      path: z.string().default(""),
      staged: z.boolean().default(false),
      ref: z.string().default(""),
    }),
    async ({ path: relPath, staged, ref }) => {
      const args = ["git", "diff", "--no-color", "--stat=200", "-p"];
      if (staged) args.push("--cached");
      if (ref) args.push(ref as string);
      if (relPath) args.push("--", relPath as string);
      const { stdout } = await execAsync(args.join(" "), { cwd: ws, timeout: 15000, maxBuffer: 1024 * 1024 * 4 });
      const out = stdout.length > 30000 ? stdout.slice(0, 30000) + "\n…(truncated)" : stdout;
      await saveStep("tool_result", `git_diff${ref ? ` vs ${ref}` : ""} — ${stdout.split("\n").length} lines`, "git_diff");
      return { ok: true, diff: out || "(no changes)" };
    },
  );

  // ---------- Built-in catalog tools (PDF, docx, web, etc.) ----------
  const enabledToolIds: Set<string> | null = userSettings?.enabledTools
    ? new Set(JSON.parse(userSettings.enabledTools) as string[])
    : null;

  for (const t of TOOL_CATALOG) {
    if (enabledToolIds && !enabledToolIds.has(t.id)) continue;
    tools[t.id] = {
      name: t.id,
      description: t.description,
      execute: async (args) => {
        try {
          const parsedArgs = t.parameters ? t.parameters.parse(args) : args;
          const result = await t.execute(parsedArgs as Record<string, unknown>, {
            conversationId: null,
            userId: session?.userId ?? null,
          });
          await saveStep("tool_result", (result as { message?: string }).message ?? `Used ${t.id}`, t.id);
          return result;
        } catch (err) {
          return { ok: false, error: `Tool ${t.id} failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  // ---------- MCP server tools ----------
  if (session?.userId) {
    const mcpServers = await prisma.mcpServer.findMany({ where: { userId: session.userId, enabled: true } });
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

  // ---------- Build system prompt with tool format teaching ----------
  const toolPromptBlock = buildToolPrompt(
    modelName,
    Object.values(tools).map((t) => ({ id: t.name, description: t.description })),
  );

  const systemPrompt = `${CODE_SYSTEM}\n\nWorkspace: ${ws}${toolPromptBlock}`;

  // ---------- Run agent loop ----------
  return createAgentStreamResponse(
    {
      model: ollama(modelName),
      systemPrompt,
      messages: [{ role: "user", content: task }] as CoreMessage[],
      tools,
      maxSteps: 30,
    },
    {
      initialAnnotations: [
        { type: "phase", step: "preparing", text: `${Object.keys(tools).length} tools loaded`, t: 0 },
        { type: "phase", step: "thinking", text: `Querying ${modelName}…`, model: modelName, t: 0 },
      ],
      onComplete: async (text) => {
        await saveStep("assistant", text || "(task complete)");
        await prisma.codeSession.update({
          where: { id: sessionId },
          data: { status: "complete", updatedAt: new Date() },
        });
      },
    },
  );
}
