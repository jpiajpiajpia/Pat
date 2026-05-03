"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  CheckCircle2, XCircle, Download, RefreshCw, Server, Sparkles, Code2,
  Brain, Eye, Search, Loader2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DepModel {
  id: string;
  displayName: string;
  role: "chat" | "code" | "reasoning" | "vision" | "embedding";
  sizeGB: number;
  description: string;
  recommended: boolean;
  required: boolean;
  installed: boolean;
  installedSizeBytes?: number;
}

interface DepStatus {
  ollama: { running: boolean; version: string | null; baseUrl: string };
  models: DepModel[];
}

interface InstallProgress {
  status?: string;          // e.g. "pulling manifest", "downloading", "verifying sha256 digest", "success"
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ROLE_META = {
  chat:      { label: "Chat",      icon: Sparkles, color: "text-indigo-400" },
  code:      { label: "Code",      icon: Code2,    color: "text-emerald-400" },
  reasoning: { label: "Reasoning", icon: Brain,    color: "text-violet-400" },
  vision:    { label: "Vision",    icon: Eye,      color: "text-cyan-400" },
  embedding: { label: "Embedding", icon: Search,   color: "text-amber-400" },
} as const;

function formatGB(gb: number) {
  return gb < 1 ? `${(gb * 1024).toFixed(0)} MB` : `${gb.toFixed(1)} GB`;
}

function ModelRow({
  model,
  progress,
  onInstall,
}: {
  model: DepModel;
  progress?: InstallProgress;
  onInstall: () => void;
}) {
  const isInstalling = progress !== undefined && progress.status !== "success" && !progress.error;
  const percent = progress?.total && progress.completed
    ? Math.round((progress.completed / progress.total) * 100)
    : null;

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-zinc-100">{model.displayName}</h4>
            <span className="text-xs text-zinc-500 font-mono">{model.id}</span>
            {model.recommended && (
              <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                Recommended
              </span>
            )}
            {model.required && (
              <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                Required
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{model.description}</p>
          <p className="text-xs text-zinc-600 mt-1">{formatGB(model.sizeGB)} download</p>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {model.installed ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium px-3 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Installed
            </div>
          ) : isInstalling ? (
            <div className="flex items-center gap-2 text-xs text-zinc-300 px-3 py-1.5 bg-zinc-800 rounded-lg min-w-[140px]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
              <span className="font-mono text-[11px]">
                {percent !== null ? `${percent}%` : (progress?.status ?? "starting…")}
              </span>
            </div>
          ) : progress?.error ? (
            <Button
              size="sm"
              onClick={onInstall}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-300 h-8 text-xs border border-red-500/30"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Retry
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onInstall}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs"
            >
              <Download className="h-3 w-3 mr-1.5" />
              Install
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isInstalling && percent !== null && (
        <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {progress?.error && (
        <p className="mt-2 text-xs text-red-400">{progress.error}</p>
      )}
    </div>
  );
}

export function DependenciesPanel() {
  const { data, mutate, isLoading } = useSWR<DepStatus>("/api/dependencies", fetcher, {
    refreshInterval: 5000,
  });

  const [installs, setInstalls] = useState<Record<string, InstallProgress>>({});

  const startInstall = useCallback(async (modelId: string) => {
    setInstalls((s) => ({ ...s, [modelId]: { status: "starting…" } }));

    try {
      const res = await fetch("/api/dependencies/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setInstalls((s) => ({ ...s, [modelId]: { error: err.error ?? "Install failed" } }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const update: InstallProgress = JSON.parse(line);
            setInstalls((s) => ({ ...s, [modelId]: { ...s[modelId], ...update } }));
            if (update.status === "success") {
              setTimeout(() => {
                setInstalls((s) => {
                  const next = { ...s };
                  delete next[modelId];
                  return next;
                });
                mutate();
              }, 1500);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setInstalls((s) => ({ ...s, [modelId]: { error: String(err) } }));
    }
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
      </div>
    );
  }

  const ollamaOk = data?.ollama.running;
  const groupedModels = (["embedding", "chat", "code", "reasoning", "vision"] as const).map((role) => ({
    role,
    items: data?.models.filter((m) => m.role === role) ?? [],
  }));

  return (
    <div className="space-y-6">
      {/* Ollama health */}
      <div className={cn(
        "rounded-xl border px-5 py-4 flex items-start gap-4",
        ollamaOk ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
      )}>
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
          ollamaOk ? "bg-emerald-500/10" : "bg-red-500/10"
        )}>
          <Server className={cn("h-5 w-5", ollamaOk ? "text-emerald-400" : "text-red-400")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">Ollama</h3>
            {ollamaOk ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Running
              </span>
            ) : (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Not reachable
              </span>
            )}
          </div>
          {ollamaOk ? (
            <p className="text-xs text-zinc-400 mt-1">
              Version {data?.ollama.version} · Listening on <span className="font-mono">{data?.ollama.baseUrl}</span>
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-zinc-400">
                Nexus needs Ollama running to use models. Install it from{" "}
                <span className="font-mono text-indigo-400">ollama.com</span> or run <span className="font-mono text-indigo-400">ollama serve</span> in a terminal.
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => mutate()}
          className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Required dependencies warning */}
      {ollamaOk && data?.models.some((m) => m.required && !m.installed) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-300">
            One or more required models are missing. Some features (like Memory) won&apos;t work until they&apos;re installed.
          </p>
        </div>
      )}

      {/* Model groups */}
      {ollamaOk && groupedModels.map(({ role, items }) => {
        if (items.length === 0) return null;
        const meta = ROLE_META[role];
        const Icon = meta.icon;
        return (
          <div key={role}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={cn("h-4 w-4", meta.color)} />
              <h3 className={cn("text-sm font-semibold", meta.color)}>{meta.label}</h3>
              <span className="text-xs text-zinc-600">
                {items.filter((m) => m.installed).length}/{items.length} installed
              </span>
            </div>
            <div className="space-y-2">
              {items.map((m) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  progress={installs[m.id]}
                  onInstall={() => startInstall(m.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
