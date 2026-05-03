"use client";

import { useState } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
  Wrench, Brain, Cpu, FileText, Globe, Hammer,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Annotation shapes emitted by /api/chat
type PhaseAnnotation = {
  type: "phase";
  step: "preparing" | "tools_loaded" | "memory" | "memory_done" | "thinking" | "done";
  text: string;
  t: number;
  count?: number;
  model?: string;
  durationMs?: number;
  memoryHits?: number;
};

type ToolStartAnnotation = {
  type: "tool_start";
  toolName: string;
  source?: "mcp" | "builtin";
  category?: string;
  server?: string;
  t: number;
};

type ToolDoneAnnotation = {
  type: "tool_done";
  toolName: string;
  ok: boolean;
  error?: string;
  file?: { filename: string; sizeBytes: number };
  t: number;
};

type Annotation = PhaseAnnotation | ToolStartAnnotation | ToolDoneAnnotation;

interface Props {
  annotations: unknown[] | undefined;
  isStreaming: boolean;
}

function isAnnotation(a: unknown): a is Annotation {
  return !!a && typeof a === "object" && typeof (a as { type?: unknown }).type === "string";
}

function ICON_FOR_STEP(step: PhaseAnnotation["step"]): React.ElementType {
  switch (step) {
    case "preparing":
    case "tools_loaded":   return Wrench;
    case "memory":
    case "memory_done":    return Brain;
    case "thinking":       return Cpu;
    case "done":           return CheckCircle2;
  }
}

function categoryIcon(category?: string): React.ElementType {
  if (category === "files") return FileText;
  if (category === "web") return Globe;
  return Hammer;
}

interface FlatStep {
  key: string;
  icon: React.ElementType;
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
}

function flatten(annotations: Annotation[], isStreaming: boolean): FlatStep[] {
  const steps: FlatStep[] = [];
  // Track in-flight tool calls so we can mark them done when matching tool_done arrives
  const inFlightTools = new Map<string, number>();

  for (let i = 0; i < annotations.length; i++) {
    const a = annotations[i];
    if (a.type === "phase") {
      const Icon = ICON_FOR_STEP(a.step);
      // Memory follows: collapse "memory" + "memory_done" into a single step
      if (a.step === "memory") {
        const next = annotations[i + 1];
        const done = next && next.type === "phase" && next.step === "memory_done" ? next : null;
        steps.push({
          key: `phase-${i}`,
          icon: Icon,
          label: done ? done.text : a.text,
          status: done ? "done" : "running",
        });
        if (done) i++;
      } else if (a.step === "memory_done") {
        // already consumed
      } else if (a.step === "preparing") {
        const next = annotations[i + 1];
        const done = next && next.type === "phase" && next.step === "tools_loaded" ? next : null;
        steps.push({
          key: `phase-${i}`,
          icon: Icon,
          label: done ? done.text : a.text,
          status: done ? "done" : "running",
        });
        if (done) i++;
      } else if (a.step === "tools_loaded") {
        // already consumed
      } else if (a.step === "thinking") {
        // Thinking step is "done" when stream finishes (we get a `done` annotation) or stream stops
        const hasDone = annotations.some((x) => x.type === "phase" && x.step === "done");
        steps.push({
          key: `phase-${i}`,
          icon: Icon,
          label: a.text,
          status: hasDone || !isStreaming ? "done" : "running",
        });
      } else if (a.step === "done") {
        // Implicit — not shown as its own row
      }
    } else if (a.type === "tool_start") {
      inFlightTools.set(a.toolName, steps.length);
      const Icon = a.source === "builtin" ? categoryIcon(a.category) : Wrench;
      steps.push({
        key: `tool-${i}`,
        icon: Icon,
        label: `Calling ${a.toolName}…`,
        status: "running",
      });
    } else if (a.type === "tool_done") {
      const idx = inFlightTools.get(a.toolName);
      if (idx !== undefined) {
        const prev = steps[idx];
        const Icon = a.file ? FileText : prev.icon;
        const detail = a.file
          ? `${a.file.filename} · ${a.file.sizeBytes < 1024 ? `${a.file.sizeBytes} B` : `${(a.file.sizeBytes / 1024).toFixed(1)} KB`}`
          : a.error;
        steps[idx] = {
          key: prev.key,
          icon: Icon,
          label: a.ok ? `Used ${a.toolName}` : `Failed ${a.toolName}`,
          detail,
          status: a.ok ? "done" : "error",
        };
        inFlightTools.delete(a.toolName);
      }
    }
  }
  return steps;
}

export function ActivityFeed({ annotations, isStreaming }: Props) {
  const list = (annotations ?? []).filter(isAnnotation) as Annotation[];

  // Collapse state: live = expanded, completed = collapsed by default
  const [forceExpanded, setForceExpanded] = useState(false);
  const isComplete = list.some((a) => a.type === "phase" && a.step === "done");
  const expanded = !isComplete || forceExpanded;

  if (list.length === 0) return null;

  const steps = flatten(list, isStreaming);
  if (steps.length === 0) return null;

  // Summary line shown when collapsed
  const doneStep = list.find((a): a is PhaseAnnotation => a.type === "phase" && a.step === "done");
  const toolsUsed = list.filter((a) => a.type === "tool_done").length;
  const summary = doneStep
    ? `${steps.length} step${steps.length === 1 ? "" : "s"}${toolsUsed > 0 ? ` · ${toolsUsed} tool${toolsUsed === 1 ? "" : "s"}` : ""}${doneStep.durationMs ? ` · ${(doneStep.durationMs / 1000).toFixed(1)}s` : ""}`
    : "Working…";

  return (
    <div
      className="w-full rounded-lg border overflow-hidden text-xs mb-2"
      style={{ background: "rgba(255,255,255,0.02)", borderColor: "var(--pat-border)" }}
    >
      {/* Header */}
      <button
        onClick={() => setForceExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
      >
        {isStreaming && !isComplete ? (
          <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" style={{ color: "var(--pat-cream)" }} />
        ) : (
          <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: "var(--pat-cream)" }} />
        )}
        <span className="font-medium flex-1" style={{ color: "var(--pat-text)" }}>
          {isStreaming && !isComplete ? "Pat is working…" : summary}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3" style={{ color: "var(--pat-muted)" }} />
        ) : (
          <ChevronRight className="h-3 w-3" style={{ color: "var(--pat-muted)" }} />
        )}
      </button>

      {/* Steps */}
      {expanded && (
        <div className="border-t px-3 py-2 space-y-1.5 font-mono" style={{ borderColor: "var(--pat-border)" }}>
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-2">
                {s.status === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" style={{ color: "var(--pat-cream)" }} />
                ) : s.status === "error" ? (
                  <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: "var(--pat-cream)" }} />
                )}
                <Icon
                  className={cn("h-3 w-3 flex-shrink-0", s.status === "error" && "text-red-400")}
                  style={s.status === "error" ? undefined : { color: "var(--pat-muted)" }}
                />
                <span
                  className={cn("flex-1 truncate", s.status === "error" && "text-red-300")}
                  style={s.status === "error" ? undefined : { color: s.status === "running" ? "var(--pat-text)" : "var(--pat-muted)" }}
                >
                  {s.label}
                </span>
                {s.detail && (
                  <span className="text-[11px] truncate max-w-[180px]" style={{ color: "var(--pat-muted)" }}>{s.detail}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
