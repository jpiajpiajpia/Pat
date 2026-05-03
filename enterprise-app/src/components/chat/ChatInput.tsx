"use client";

import { useRef, useEffect } from "react";
import { Send, Square, Paperclip } from "lucide-react";
import { useAppStore } from "@/store/app";
import { ModelSelector } from "./ModelSelector";

interface Props {
  input: string;
  isLoading: boolean;
  onInputChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  onFileSelect?: (file: File) => void;
}

export function ChatInput({ input, isLoading, onInputChange, onSubmit, onStop, onFileSelect }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, selectedChatModel, setSelectedChatModel } = useAppStore();

  const activeModel = selectedChatModel ?? user?.settings?.defaultChatModel ?? "mistral:7b";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Re-focus when assistant finishes streaming
  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) onSubmit(e as unknown as React.FormEvent);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !onFileSelect) return;
    for (const f of Array.from(files)) onFileSelect(f);
    e.target.value = "";
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        className="flex items-end gap-2 rounded-2xl px-3 py-3 transition-all border"
        style={{
          background: "var(--pat-surface)",
          borderColor: "var(--pat-border)",
        }}
        onFocus={() => {}}
      >
        {/* Paperclip */}
        {onFileSelect && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-all mb-0.5"
            style={{ color: "var(--pat-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-text)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Pat…"
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none outline-none min-h-[24px] max-h-[200px] leading-6"
          style={{ color: "var(--pat-text)" }}
        />

        <ModelSelector
          value={activeModel}
          onChange={(id) => setSelectedChatModel(id)}
          filter={(m) => m.role === "chat" || m.role === "reasoning" || m.role === "vision"}
        />

        <button
          onClick={isLoading ? onStop : (e) => onSubmit(e as unknown as React.FormEvent)}
          disabled={!isLoading && !input.trim()}
          className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
          style={{ background: "var(--pat-cream)", color: "var(--pat-bg)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          {isLoading ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
