"use client";

import { useState, useCallback, useEffect } from "react";
import { useChat } from "ai/react";
import { AgentFeed } from "./AgentFeed";
import { WorkspacePanel } from "./WorkspacePanel";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { useAppStore } from "@/store/app";
import {
  Code2, FolderOpen, Send, Square, X,
  ChevronRight, Loader2, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

interface Step { id: string; type: string; content: string; toolName?: string | null; createdAt: string; }
interface Session { id: string; title: string; workspace: string; status: string; steps: Step[]; }

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  sessionId: string;
}

export function CodeWindow({ sessionId }: Props) {
  const { user, selectedCodeModel, setSelectedCodeModel } = useAppStore();
  const activeModel =
    selectedCodeModel ?? user?.settings?.defaultCodeModel ?? "qwen2.5-coder:7b";

  const [task, setTask] = useState("");
  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null);
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [hasNativePicker, setHasNativePicker] = useState(false);

  // Detect Electron preload bridge once mounted (window not available during SSR)
  useEffect(() => {
    setHasNativePicker(typeof window !== "undefined" && typeof window.nexus?.pickFolder === "function");
  }, []);

  const { data: session, mutate: mutateSession } = useSWR<Session>(
    `/api/code/sessions/${sessionId}`,
    fetcher,
    { refreshInterval: (data) => (data?.status === "running" ? 2500 : 0), revalidateOnFocus: true }
  );

  const isRunning = session?.status === "running";
  const workspace = session?.workspace ?? "";

  const { messages, isLoading, stop, append, setMessages } = useChat({
    api: "/api/code/run",
    body: { sessionId, workspace, model: activeModel },
    onFinish: () => {
      mutateSession();
    },
  });

  async function handleSubmit() {
    if (!task.trim() || isLoading) return;
    const t = task.trim();
    setTask("");
    setMessages([]);

    // If no workspace set, prompt for one first
    if (!workspace) {
      setTask(t);
      await requestWorkspaceChange();
      return;
    }

    // Update session title
    await fetch(`/api/code/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t.slice(0, 60), status: "running" }),
    });
    mutateSession();

    append({ role: "user", content: t }, { body: { sessionId, workspace, model: activeModel, task: t } });
  }

  async function setWorkspace(ws: string) {
    if (!ws) return;
    await fetch(`/api/code/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: ws }),
    });
    mutateSession();
    setShowWorkspacePicker(false);
    setWorkspaceDraft("");
  }

  // Primary entry point for picking a workspace.
  // - In the packaged app: opens the native macOS folder picker via Electron IPC.
  // - In dev mode (browser): falls back to the manual text-input panel.
  async function requestWorkspaceChange() {
    if (hasNativePicker && window.nexus) {
      const picked = await window.nexus.pickFolder();
      if (picked) await setWorkspace(picked);
      return;
    }
    setShowWorkspacePicker(true);
  }

  const handleFileClick = useCallback(async (relPath: string) => {
    if (!workspace) return;
    const res = await fetch(`/api/code/file?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(relPath)}&op=read`);
    const data = await res.json() as { content?: string; error?: string };
    if (data.content !== undefined) setFileContent({ path: relPath, content: data.content });
  }, [workspace]);

  const savedSteps = session?.steps ?? [];
  const hasActivity = savedSteps.length > 0 || messages.length > 1;

  return (
    <div className="flex h-full">
      {/* Left: workspace file tree */}
      <div className="w-52 flex-shrink-0 border-r border-white/10 bg-zinc-950">
        <WorkspacePanel workspace={workspace} onFileClick={handleFileClick} />
      </div>

      {/* Center: agent feed + task input */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Code2 className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">Code Agent</span>
          {session?.title && session.title !== "New task" && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
              <span className="text-sm text-zinc-400 truncate">{session.title}</span>
            </>
          )}
          {isRunning && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Running
            </span>
          )}
          {workspace ? (
            <button
              onClick={requestWorkspaceChange}
              title={`Workspace: ${workspace}`}
              className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors max-w-xs"
            >
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-mono truncate">{workspace.split("/").slice(-2).join("/")}</span>
            </button>
          ) : (
            <button
              onClick={requestWorkspaceChange}
              className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Set workspace
            </button>
          )}
        </div>

        {/* Manual workspace picker — shown when the native picker isn't available
            (i.e. running in a regular browser during dev). In the packaged app,
            requestWorkspaceChange opens the native macOS folder dialog instead. */}
        {showWorkspacePicker && (
          <div className="border-b border-white/10 bg-zinc-900 p-3 space-y-2">
            <p className="text-xs text-zinc-500">
              Native folder picker isn&apos;t available in the dev preview — paste the absolute path to your workspace folder below.
            </p>
            <div className="flex gap-2">
              <input
                value={workspaceDraft}
                onChange={(e) => setWorkspaceDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setWorkspace(workspaceDraft)}
                placeholder="/Users/you/your-project"
                className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500/50"
                autoFocus
              />
              <button
                onClick={() => setWorkspace(workspaceDraft)}
                disabled={!workspaceDraft.trim()}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-40 transition-colors"
              >
                Set
              </button>
              <button onClick={() => setShowWorkspacePicker(false)} className="text-zinc-500 hover:text-zinc-200 px-2">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasActivity && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="h-14 w-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center">
              <Code2 className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-200">What should we build?</h2>
              <p className="text-sm text-zinc-500 mt-1">
                Describe a task — the agent will read, write, and edit files to get it done.
              </p>
              {!workspace && (
                <button
                  onClick={requestWorkspaceChange}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm transition-colors"
                >
                  <FolderOpen className="h-4 w-4" /> Choose workspace folder
                </button>
              )}
            </div>
          </div>
        ) : (
          <AgentFeed
            messages={messages}
            savedSteps={isRunning ? [] : savedSteps}
            isRunning={isLoading}
          />
        )}

        {/* Task input */}
        <div className="px-4 pb-4 pt-2 border-t border-white/10">
          <div className="flex items-end gap-2 bg-zinc-800 border border-emerald-500/20 focus-within:border-emerald-500/50 rounded-2xl px-4 py-3 transition-all">
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
              }}
              placeholder="Describe a coding task… (e.g. Add input validation to the login form)"
              rows={2}
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 resize-none outline-none min-h-[48px] max-h-[160px] leading-6 disabled:opacity-50"
            />
            <ModelSelector
              value={activeModel}
              onChange={(id) => setSelectedCodeModel(id)}
              filter={(m) => m.role === "code" || m.role === "reasoning"}
            />
            <button
              onClick={isLoading ? stop : handleSubmit}
              disabled={!isLoading && !task.trim()}
              className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 bg-emerald-700 hover:bg-emerald-600 text-white"
            >
              {isLoading ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Right: file viewer (shown when a file is clicked) */}
      {fileContent && (
        <div className="w-96 flex-shrink-0 border-l border-white/10 bg-zinc-950 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-400 flex-1 truncate font-mono">{fileContent.path}</span>
            <button onClick={() => setFileContent(null)} className="text-zinc-600 hover:text-zinc-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-4 text-xs text-zinc-300 font-mono leading-5 whitespace-pre-wrap break-all">
            {fileContent.content}
          </pre>
        </div>
      )}
    </div>
  );
}
