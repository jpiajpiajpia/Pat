"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { FileText, Globe, Wrench, Loader2, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app";
import { ToolsTestPanel } from "./ToolsTestPanel";

interface ToolMeta {
  id: string;
  displayName: string;
  category: "files" | "web" | "utility";
  uiHint: string;
}
interface ToolsResponse {
  tools: ToolMeta[];
  capableModels: string[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CATEGORY_META = {
  files:   { label: "File creation", icon: FileText, color: "text-emerald-400" },
  web:     { label: "Web & data",    icon: Globe,    color: "text-cyan-400" },
  utility: { label: "Utilities",     icon: Wrench,   color: "text-amber-400" },
} as const;

export function ToolsPanel() {
  const { user, setUser, selectedChatModel } = useAppStore();
  const { data } = useSWR<ToolsResponse>("/api/tools", fetcher);

  // Local state mirrors the user's enabledTools setting
  const [enabled, setEnabled] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    // Initialize from user settings; null in DB means "all enabled"
    if (!data) return;
    const stored = user?.settings?.enabledTools;
    if (stored) {
      try {
        setEnabled(new Set(JSON.parse(stored) as string[]));
        return;
      } catch {
        // fall through
      }
    }
    setEnabled(new Set(data.tools.map((t) => t.id)));
  }, [data, user?.settings?.enabledTools]);

  function toggle(id: string) {
    setEnabled((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAll(category: "files" | "web" | "utility" | "all", value: boolean) {
    if (!data || !enabled) return;
    const next = new Set(enabled);
    for (const t of data.tools) {
      if (category === "all" || t.category === category) {
        if (value) next.add(t.id);
        else next.delete(t.id);
      }
    }
    setEnabled(next);
  }

  async function save() {
    if (!user || !enabled) return;
    setSaving(true);
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        settings: { enabledTools: JSON.stringify(Array.from(enabled)) },
      }),
    });
    const updated = await res.json();
    setUser(updated);
    setSavedAt(Date.now());
    setSaving(false);
  }

  const dirty = enabled && data && (
    JSON.stringify(Array.from(enabled).sort()) !==
    JSON.stringify(JSON.parse(user?.settings?.enabledTools ?? JSON.stringify(data.tools.map((t) => t.id))).sort())
  );

  if (!data || !enabled) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 text-zinc-500 animate-spin" /></div>;
  }

  // Determine if the user's currently selected chat model supports tool calling
  const activeModel = selectedChatModel ?? user?.settings?.defaultChatModel ?? "mistral:7b";
  const modelSupportsTools = data.capableModels.includes(activeModel);

  const grouped = (["files", "web", "utility"] as const).map((category) => ({
    category,
    items: data.tools.filter((t) => t.category === category),
  }));

  const enabledCount = enabled.size;

  return (
    <div className="space-y-6">
      {/* Test panel — verify each tool actually works */}
      <ToolsTestPanel />

      {/* Tool-calling support warning */}
      {!modelSupportsTools && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 leading-relaxed">
            Your current chat model <span className="font-mono text-amber-300">{activeModel}</span> doesn&apos;t reliably support tool calling.
            Tools will be ignored until you switch to a tool-capable model
            (Mistral, Llama 3.x, Qwen 2.5, Phi-4, Gemma 3, or DeepSeek Coder V2).
          </div>
        </div>
      )}

      {/* Summary + bulk actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-300 font-medium">{enabledCount}</span> of {data.tools.length} tools enabled
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => setAll("all", true)}
            className="text-xs px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          >
            Enable all
          </button>
          <button
            onClick={() => setAll("all", false)}
            className="text-xs px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          >
            Disable all
          </button>
        </div>
      </div>

      {/* Categories */}
      {grouped.map(({ category, items }) => {
        const meta = CATEGORY_META[category];
        const Icon = meta.icon;
        const groupEnabledCount = items.filter((t) => enabled.has(t.id)).length;

        return (
          <div key={category} className="rounded-xl border border-white/10 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", meta.color)} />
                <h3 className={cn("text-sm font-semibold", meta.color)}>{meta.label}</h3>
                <span className="text-xs text-zinc-600">{groupEnabledCount}/{items.length}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setAll(category, true)} className="text-[11px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5">All</button>
                <button onClick={() => setAll(category, false)} className="text-[11px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5">None</button>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((t) => {
                const on = enabled.has(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggle(t.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium", on ? "text-zinc-100" : "text-zinc-500")}>{t.displayName}</span>
                        <span className="text-[10px] font-mono text-zinc-600">{t.id}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{t.uiHint}</p>
                    </div>
                    {on ? (
                      <ToggleRight className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-zinc-700 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-end gap-3">
        {savedAt > 0 && Date.now() - savedAt < 3000 && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        <Button
          onClick={save}
          disabled={!dirty || saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save tool selection
        </Button>
      </div>
    </div>
  );
}
