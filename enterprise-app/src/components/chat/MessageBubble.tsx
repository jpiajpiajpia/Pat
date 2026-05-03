"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown, ChevronRight, Wrench, Download, FileText, FileSpreadsheet,
  Presentation, Image as ImageIcon, FileJson, Calendar, Code as CodeIcon,
  Brain, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, ToolInvocation } from "ai";
import { ActivityFeed } from "./ActivityFeed";

interface AttachedFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
}

interface Props {
  message: Message;
  userInitials?: string;
  isStreaming?: boolean;
}

function extractAttachments(data: unknown): AttachedFile[] {
  if (!data || typeof data !== "object") return [];
  const attached = (data as { attachedFiles?: unknown }).attachedFiles;
  if (!Array.isArray(attached)) return [];
  return attached.filter(
    (f): f is AttachedFile =>
      !!f && typeof f === "object" && typeof (f as AttachedFile).id === "string" && typeof (f as AttachedFile).filename === "string"
  );
}

// DeepSeek R1 / reasoning models emit <think>…</think> blocks
function splitThinkContent(content: string): { thinking: string; answer: string; thinkingActive: boolean } {
  // If <think> is opened but not yet closed, treat all subsequent content as live thinking
  const openMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
  if (!openMatch) return { thinking: "", answer: content, thinkingActive: false };
  const isOpen = !content.includes("</think>");
  const thinking = openMatch[1].trim();
  const answer = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "").trim();
  return { thinking, answer, thinkingActive: isOpen };
}

interface GeneratedFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
}

function isGeneratedFileResult(result: unknown): result is { ok: true; file: GeneratedFile; message?: string } {
  return !!result && typeof result === "object"
    && (result as { ok?: unknown }).ok === true
    && typeof (result as { file?: unknown }).file === "object"
    && (result as { file: { downloadUrl?: unknown } }).file !== null
    && typeof (result as { file: { downloadUrl: unknown } }).file.downloadUrl === "string";
}

function fileIconForMime(mime: string): React.ElementType {
  if (mime.includes("pdf")) return FileText;
  if (mime.includes("wordprocessingml")) return FileText;
  if (mime.includes("spreadsheetml") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("presentationml")) return Presentation;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("json") || mime.includes("yaml")) return FileJson;
  if (mime.includes("calendar")) return Calendar;
  if (mime.includes("html") || mime.includes("svg") || mime.includes("mermaid")) return CodeIcon;
  return FileText;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function GeneratedFileChip({ file }: { file: GeneratedFile }) {
  const Icon = fileIconForMime(file.mimeType);
  return (
    <a
      href={file.downloadUrl}
      download={file.filename}
      className="group flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors max-w-md"
      style={{ background: "var(--pat-cream-10)", borderColor: "rgba(200,169,110,0.3)" }}
    >
      <div
        className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--pat-cream-20)" }}
      >
        <Icon className="h-4 w-4" style={{ color: "var(--pat-cream)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: "var(--pat-text)" }}>{file.filename}</div>
        <div className="text-xs" style={{ color: "var(--pat-muted)" }}>{formatBytes(file.sizeBytes)}</div>
      </div>
      <Download className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 flex-shrink-0" style={{ color: "var(--pat-cream)" }} />
    </a>
  );
}

function AttachmentChip({ file }: { file: AttachedFile }) {
  const Icon = fileIconForMime(file.mimeType);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs"
      style={{ background: "var(--pat-cream-10)", borderColor: "rgba(200,169,110,0.25)", color: "var(--pat-cream)" }}
    >
      <Paperclip className="h-3 w-3" />
      <Icon className="h-3 w-3 opacity-70" />
      <span className="font-medium" style={{ color: "var(--pat-text)" }}>{file.filename}</span>
      {file.sizeBytes !== undefined && <span style={{ color: "var(--pat-muted)" }}>· {formatBytes(file.sizeBytes)}</span>}
    </span>
  );
}

export function MessageBubble({ message, userInitials = "U", isStreaming = false }: Props) {
  const isUser = message.role === "user";
  const [toolsOpen, setToolsOpen] = useState(false);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);
  const reasoningRef = useRef<HTMLDivElement>(null);

  const toolInvocations: ToolInvocation[] = message.toolInvocations ?? [];
  const annotations = message.annotations as unknown[] | undefined;
  const attachedFiles: AttachedFile[] = extractAttachments(message.data);

  // Pull out generated files from native tool results AND from annotations (our text-parser path)
  const generatedFiles: GeneratedFile[] = [];
  for (const inv of toolInvocations) {
    if (inv.state === "result" && isGeneratedFileResult(inv.result)) {
      generatedFiles.push(inv.result.file);
    }
  }
  if (annotations) {
    for (const a of annotations) {
      const ann = a as { type?: string; file?: GeneratedFile };
      if (ann.type === "tool_done" && ann.file && typeof ann.file.downloadUrl === "string") {
        generatedFiles.push(ann.file);
      }
    }
  }
  // De-dupe by id
  const dedupedGenerated = Array.from(new Map(generatedFiles.map((f) => [f.id, f])).values());

  // Reasoning extraction (live during streaming for <think> blocks)
  const { thinking, answer, thinkingActive } = isUser
    ? { thinking: "", answer: message.content, thinkingActive: false }
    : splitThinkContent(message.content || "");

  // Auto-open the reasoning panel when streaming, auto-close shortly after stream completes
  useEffect(() => {
    if (thinkingActive) setThoughtsOpen(true);
    else if (thinking && !isStreaming) {
      const t = setTimeout(() => setThoughtsOpen(false), 2000);
      return () => clearTimeout(t);
    }
  }, [thinkingActive, thinking, isStreaming]);

  // Auto-scroll the reasoning panel to bottom as content streams in
  useEffect(() => {
    if (thoughtsOpen && thinkingActive && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [thinking, thoughtsOpen, thinkingActive]);

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold",
          isUser ? "" : "font-serif"
        )}
        style={
          isUser
            ? { background: "var(--pat-cream-20)", color: "var(--pat-cream)" }
            : { background: "var(--pat-cream-20)", color: "var(--pat-cream)" }
        }
      >
        {isUser ? userInitials : "P"}
      </div>

      <div className={cn("flex flex-col gap-2 max-w-[80%]", isUser && "items-end")}>
        {/* User attachments — above the message bubble */}
        {isUser && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachedFiles.map((f) => (
              <AttachmentChip key={f.id} file={f} />
            ))}
          </div>
        )}

        {/* Activity feed — only on assistant messages */}
        {!isUser && annotations && annotations.length > 0 && (
          <ActivityFeed annotations={annotations} isStreaming={isStreaming} />
        )}

        {/* Reasoning panel (DeepSeek R1 style) */}
        {!isUser && thinking && (
          <div
            className="w-full rounded-lg border overflow-hidden text-xs"
            style={{ background: "rgba(200,169,110,0.04)", borderColor: "rgba(200,169,110,0.18)" }}
          >
            <button
              onClick={() => setThoughtsOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
            >
              <Brain className="h-3 w-3" style={{ color: "var(--pat-cream)" }} />
              <span className="font-medium flex-1" style={{ color: "var(--pat-cream)" }}>
                {thinkingActive ? "Pat is thinking…" : "Reasoning"}
              </span>
              {thinkingActive && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--pat-cream)" }} />
              )}
              {thoughtsOpen ? (
                <ChevronDown className="h-3 w-3" style={{ color: "var(--pat-cream)" }} />
              ) : (
                <ChevronRight className="h-3 w-3" style={{ color: "var(--pat-cream)" }} />
              )}
            </button>
            {thoughtsOpen && (
              <div
                ref={reasoningRef}
                className="border-t px-3 py-2 leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto"
                style={{ borderColor: "rgba(200,169,110,0.15)", color: "var(--pat-muted)" }}
              >
                {thinking}
              </div>
            )}
          </div>
        )}

        {/* Generated file chips */}
        {dedupedGenerated.length > 0 && (
          <div className="space-y-1.5 w-full">
            {dedupedGenerated.map((f) => (
              <GeneratedFileChip key={f.id} file={f} />
            ))}
          </div>
        )}

        {/* Tool-invocation details (native ai-sdk path; our text-parser path uses annotations) */}
        {toolInvocations.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: "var(--pat-muted)" }}
            >
              <Wrench className="h-3 w-3" />
              {toolInvocations.length} tool call{toolInvocations.length !== 1 ? "s" : ""}
              {toolsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {toolsOpen && (
              <div className="space-y-1 mt-1">
                {toolInvocations.map((inv, i) => (
                  <div
                    key={i}
                    className="rounded-lg border px-3 py-2 text-xs font-mono"
                    style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)" }}
                  >
                    <div className="font-medium" style={{ color: "var(--pat-cream)" }}>{inv.toolName}</div>
                    <div className="mt-1 whitespace-pre-wrap" style={{ color: "var(--pat-muted)" }}>
                      {JSON.stringify(inv.args, null, 2)}
                    </div>
                    {inv.state === "result" && (
                      <div
                        className="mt-1 pt-1 border-t whitespace-pre-wrap max-h-40 overflow-y-auto"
                        style={{ borderColor: "var(--pat-border)", color: "var(--pat-text)" }}
                      >
                        {typeof inv.result === "string"
                          ? inv.result
                          : JSON.stringify(inv.result, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(isUser ? message.content : answer) && (
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
              isUser ? "rounded-tr-sm" : "rounded-tl-sm"
            )}
            style={
              isUser
                ? { background: "var(--pat-cream)", color: "var(--pat-bg)" }
                : { background: "var(--pat-surface)", color: "var(--pat-text)" }
            }
          >
            {isUser ? message.content : answer}
          </div>
        )}
      </div>
    </div>
  );
}
