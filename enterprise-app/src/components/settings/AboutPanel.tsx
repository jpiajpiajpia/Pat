"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";

interface DepStatus { ollama: { running: boolean; version: string | null; baseUrl: string }; }
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AboutPanel() {
  const { data: deps } = useSWR<DepStatus>("/api/dependencies", fetcher);
  const router = useRouter();

  const info: Array<[string, string]> = [
    ["Application",       "Pat"],
    ["Version",           "1.3.0"],
    ["Ollama version",    deps?.ollama.version ?? "—"],
    ["Ollama endpoint",   deps?.ollama.baseUrl ?? "—"],
    ["Database",          "SQLite (local)"],
    ["Embedding model",   "nomic-embed-text · 768-dim"],
  ];

  return (
    <div className="space-y-6">
      {/* Documentation card — primary call-to-action */}
      <button
        onClick={() => router.push("/docs")}
        className="w-full rounded-xl border p-5 flex items-center gap-4 text-left transition-all"
        style={{ background: "var(--pat-cream-10)", borderColor: "rgba(200,169,110,0.3)" }}
      >
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--pat-cream-20)" }}
        >
          <BookOpen className="h-5 w-5" style={{ color: "var(--pat-cream)" }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold" style={{ color: "var(--pat-text)" }}>
            Documentation
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--pat-muted)" }}>
            Full guide to every feature, tool, and setting
          </p>
        </div>
        <ChevronRight className="h-4 w-4" style={{ color: "var(--pat-cream)" }} />
      </button>
      <div className="rounded-xl border p-6" style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)" }}>
        <div className="flex items-center gap-3 mb-5">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ background: "var(--pat-cream-20)" }}
          >
            <span className="font-serif text-2xl font-semibold" style={{ color: "var(--pat-cream)" }}>P</span>
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--pat-text)" }}>Pat</h2>
            <p className="text-xs" style={{ color: "var(--pat-muted)" }}>Your local AI assistant</p>
          </div>
        </div>

        <dl className="space-y-2.5">
          {info.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between text-xs py-1.5 border-b last:border-0"
              style={{ borderColor: "var(--pat-border)" }}
            >
              <dt style={{ color: "var(--pat-muted)" }}>{label}</dt>
              <dd className="font-mono" style={{ color: "var(--pat-text)" }}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl border p-5" style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)" }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--pat-text)" }}>Privacy</h3>
        <p className="text-xs leading-relaxed" style={{ color: "var(--pat-muted)" }}>
          Pat runs entirely on your machine. Conversations, memories, and code session data are stored locally
          in SQLite. Inference happens through your local Ollama instance — no chat content ever leaves this device.
          MCP servers you connect to may receive tool-call data per their own privacy policies.
        </p>
      </div>
    </div>
  );
}
