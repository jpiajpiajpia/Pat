"use client";

import { useEffect, useRef, useState, useCallback, DragEvent } from "react";
import { useChat } from "ai/react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { useAppStore } from "@/store/app";
import { Paperclip, X } from "lucide-react";

interface InitialMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: { attachedFiles?: Array<{ id: string; filename: string; mimeType: string; sizeBytes?: number }> };
}

interface Props {
  conversationId: string;
  initialMessages?: InitialMessage[];
}

interface UploadedFile { id: string; name: string; mimeType: string; }

const SUGGESTIONS = [
  { label: "Summarize a document", prompt: "Summarize this document for me: " },
  { label: "Explore an idea", prompt: "Help me think through this idea: " },
  { label: "Review my code", prompt: "Review this code and suggest improvements:\n\n" },
  { label: "Draft a message", prompt: "Help me draft a professional message about: " },
];

export function ChatWindow({ conversationId, initialMessages = [] }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user, selectedChatModel } = useAppStore();
  const activeModel = selectedChatModel ?? user?.settings?.defaultChatModel ?? "mistral:7b";

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    api: "/api/chat",
    initialMessages,
    body: {
      conversationId,
      userId: user?.id,
      model: activeModel,
      fileIds: uploadedFiles.map((f) => f.id),
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json() as { id?: string; filename?: string; mimeType?: string; error?: string };
      if (data.id) {
        setUploadedFiles((prev) => [...prev, { id: data.id!, name: data.filename!, mimeType: data.mimeType! }]);
      }
    } catch { /* silently fail */ }
    setUploading(false);
  }

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    for (const file of Array.from(e.dataTransfer.files)) {
      uploadFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;
    const attached = uploadedFiles.map((f) => ({
      id: f.id,
      filename: f.name,
      mimeType: f.mimeType,
    }));
    // Fire-and-forget persist (optimistic UI — model call starts immediately below)
    void fetch(`/api/conversations/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", content: input, attachedFiles: attached }),
    });
    // Pass attachments inline on the message so MessageBubble renders chips immediately
    handleSubmit(e, { data: { attachedFiles: attached } });
    setUploadedFiles([]);
  }

  function setSuggestion(prompt: string) {
    handleInputChange({ target: { value: prompt } } as React.ChangeEvent<HTMLTextAreaElement>);
  }

  return (
    <div
      className="flex flex-col h-full relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag-over overlay */}
      {isDragOver && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 pointer-events-none"
          style={{ background: "rgba(200,169,110,0.08)", border: "2px dashed var(--pat-cream)" }}
        >
          <Paperclip className="h-10 w-10" style={{ color: "var(--pat-cream)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--pat-cream)" }}>Drop files to attach</p>
        </div>
      )}

      {/* Messages / Empty state */}
      <div
        className="flex-1 overflow-y-auto py-4 relative"
        style={
          messages.length === 0
            ? {
                backgroundImage: "url('/pat-background.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "right center",
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      >
        {messages.length === 0 ? (
          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6 px-8 pb-12">
            {/* Pat avatar */}
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center border"
              style={{ background: "var(--pat-cream-10)", borderColor: "rgba(200,169,110,0.25)" }}
            >
              <span className="font-serif text-4xl font-medium" style={{ color: "var(--pat-cream)" }}>
                P
              </span>
            </div>

            <div className="text-center">
              <h1 className="font-serif text-4xl font-medium mb-2" style={{ color: "var(--pat-text)" }}>
                Hey, I&apos;m Pat.
              </h1>
              <p className="text-sm" style={{ color: "var(--pat-muted)" }}>
                What can I help you with today?
              </p>
            </div>

            {/* Suggestion cards */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSuggestion(s.prompt)}
                  className="text-left p-3 rounded-xl border text-xs transition-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderColor: "var(--pat-border)",
                    color: "var(--pat-muted)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--pat-cream-10)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,169,110,0.3)";
                    (e.currentTarget as HTMLElement).style.color = "var(--pat-text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--pat-border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--pat-muted)";
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                message={m}
                userInitials={user?.avatarInitials ?? "U"}
                isStreaming={isLoading && i === messages.length - 1 && m.role === "assistant"}
              />
            ))}
            {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
              <div className="flex gap-3 px-4 py-3">
                <div
                  className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold font-serif"
                  style={{ background: "var(--pat-cream-20)", color: "var(--pat-cream)" }}
                >
                  P
                </div>
                <div className="flex-1 max-w-[80%]">
                  <div
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                    style={{ borderColor: "var(--pat-border)", background: "rgba(255,255,255,0.03)", color: "var(--pat-muted)" }}
                  >
                    <span
                      className="inline-flex h-2 w-2 rounded-full animate-pulse"
                      style={{ background: "var(--pat-cream)" }}
                    />
                    Thinking…
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attached files strip */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 pb-1 flex flex-wrap gap-1.5">
          {uploadedFiles.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border"
              style={{ background: "var(--pat-cream-10)", borderColor: "rgba(200,169,110,0.3)", color: "var(--pat-cream)" }}
            >
              <Paperclip className="h-3 w-3" />
              {f.name}
              <button
                onClick={() => setUploadedFiles((prev) => prev.filter((u) => u.id !== f.id))}
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {uploading && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border" style={{ borderColor: "var(--pat-border)", color: "var(--pat-muted)" }}>
              Uploading…
            </span>
          )}
        </div>
      )}

      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={(v) =>
          handleInputChange({ target: { value: v } } as React.ChangeEvent<HTMLTextAreaElement>)
        }
        onSubmit={handleFormSubmit}
        onStop={stop}
        onFileSelect={uploadFile}
      />
    </div>
  );
}
