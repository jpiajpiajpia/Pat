"use client";

import { useEffect, useRef } from "react";
import { FileText, Terminal, CheckCircle2, AlertCircle, Cpu, FolderOpen, Edit3, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, ToolInvocation } from "ai";

interface Step {
  id: string;
  type: string;
  content: string;
  toolName?: string | null;
  createdAt: string;
}

interface Props {
  messages: Message[];
  savedSteps?: Step[];
  isRunning: boolean;
}

const TOOL_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  read_file:       { icon: FileText, color: "text-blue-400",    label: "Read" },
  write_file:      { icon: Edit3,    color: "text-emerald-400", label: "Write" },
  edit_file:       { icon: Edit3,    color: "text-yellow-400",  label: "Edit" },
  list_directory:  { icon: FolderOpen, color: "text-zinc-400",  label: "List" },
  create_directory:{ icon: Plus,     color: "text-indigo-400",  label: "Mkdir" },
  search_files:    { icon: Search,   color: "text-violet-400",  label: "Search" },
  run_command:     { icon: Terminal, color: "text-orange-400",  label: "Shell" },
  file_exists:     { icon: FileText, color: "text-zinc-500",    label: "Exists?" },
};

function ToolCallCard({ inv }: { inv: ToolInvocation }) {
  const meta = TOOL_META[inv.toolName] ?? { icon: Cpu, color: "text-zinc-400", label: inv.toolName };
  const Icon = meta.icon;
  const args = inv.args as Record<string, unknown>;
  const primaryArg = args.path ?? args.command ?? args.pattern ?? "";

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950 overflow-hidden text-xs font-mono">
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-zinc-900")}>
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", meta.color)} />
        <span className={cn("font-semibold", meta.color)}>{meta.label}</span>
        {primaryArg && <span className="text-zinc-400 truncate">{String(primaryArg)}</span>}
        {inv.state !== "result" && (
          <span className="ml-auto text-zinc-600 animate-pulse">running…</span>
        )}
      </div>
      {inv.state === "result" && inv.result !== undefined && (
        <div className="px-3 py-2 text-zinc-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
          {typeof inv.result === "string"
            ? inv.result.slice(0, 2000)
            : JSON.stringify(inv.result, null, 2).slice(0, 2000)}
        </div>
      )}
    </div>
  );
}

function SavedStepCard({ step }: { step: Step }) {
  const isToolCall = step.type === "tool_call";
  const isToolResult = step.type === "tool_result";
  const isError = step.type === "error";
  const meta = step.toolName ? TOOL_META[step.toolName] : null;
  const Icon = meta?.icon ?? (isError ? AlertCircle : isToolCall ? Terminal : CheckCircle2);

  return (
    <div className={cn("rounded-lg border overflow-hidden text-xs font-mono",
      isError ? "border-red-500/20 bg-red-950/20" : "border-white/10 bg-zinc-950"
    )}>
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-white/10">
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", meta?.color ?? (isError ? "text-red-400" : "text-zinc-500"))} />
        <span className={cn("font-semibold", meta?.color ?? "text-zinc-400")}>{step.toolName ?? step.type}</span>
      </div>
      <div className="px-3 py-2 text-zinc-400 max-h-40 overflow-y-auto whitespace-pre-wrap">
        {step.content.slice(0, 1000)}
      </div>
    </div>
  );
}

export function AgentFeed({ messages, savedSteps = [], isRunning }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, savedSteps]);

  // During active run: use streaming messages for live display
  // After completion: savedSteps has the persisted record
  const hasLiveMessages = messages.some((m) => m.role === "assistant" && m.content);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
      {/* Persisted steps (from prior runs or completed session) */}
      {!isRunning && savedSteps.map((step) =>
        step.type === "assistant" ? (
          <div key={step.id} className="rounded-lg bg-zinc-900 border border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-emerald-400 text-xs mb-2">
              <CheckCircle2 className="h-3.5 w-3.5" /> Agent response
            </div>
            <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">{step.content}</p>
          </div>
        ) : (
          <SavedStepCard key={step.id} step={step} />
        )
      )}

      {/* Live streaming messages */}
      {isRunning && messages.map((m) => {
        if (m.role === "user") return null;

        const toolInvocations: ToolInvocation[] = m.toolInvocations ?? [];

        return (
          <div key={m.id} className="space-y-2">
            {toolInvocations.map((inv, i) => (
              <ToolCallCard key={i} inv={inv} />
            ))}
            {m.content && (
              <div className="rounded-lg bg-zinc-900 border border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Agent
                </div>
                <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">{m.content}</p>
              </div>
            )}
          </div>
        );
      })}

      {isRunning && !hasLiveMessages && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <Cpu className="h-3.5 w-3.5 animate-pulse" />
          Agent is thinking…
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
