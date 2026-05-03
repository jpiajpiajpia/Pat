"use client";

import { useState, useEffect } from "react";
import { Play, Check, X, Loader2, Download, RefreshCw } from "lucide-react";

interface ToolMeta {
  id: string;
  displayName: string;
  category: string;
  sampleArgs: Record<string, unknown>;
}

interface TestResult {
  ok: boolean;
  elapsed?: number;
  error?: string;
  file?: { id: string; filename: string; sizeBytes: number; downloadUrl: string };
  result?: unknown;
}

const CATEGORY_ORDER: Array<{ id: string; label: string }> = [
  { id: "files", label: "File Generation" },
  { id: "web", label: "Web Access" },
  { id: "utility", label: "Utility" },
];

export function ToolsTestPanel() {
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [runningAll, setRunningAll] = useState(false);

  useEffect(() => {
    fetch("/api/tools/test")
      .then((r) => r.json())
      .then((d) => setTools(d.tools ?? []));
  }, []);

  async function runOne(id: string) {
    setRunning((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/tools/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as TestResult;
      setResults((prev) => ({ ...prev, [id]: data }));
    } catch (err) {
      setResults((prev) => ({ ...prev, [id]: { ok: false, error: String(err) } }));
    } finally {
      setRunning((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function runAll() {
    setRunningAll(true);
    setResults({});
    for (const t of tools) {
      await runOne(t.id);
    }
    setRunningAll(false);
  }

  const passed = Object.values(results).filter((r) => r.ok).length;
  const failed = Object.values(results).filter((r) => !r.ok).length;
  const total = tools.length;

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div
        className="rounded-xl border p-5 flex items-center gap-4"
        style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)" }}
      >
        <div className="flex-1">
          <h3 className="text-sm font-semibold" style={{ color: "var(--pat-text)" }}>
            Verify your toolset
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--pat-muted)" }}>
            Runs each tool with realistic sample inputs. Confirms libraries are installed,
            file output works, and web tools reach the internet.
          </p>
          {(passed > 0 || failed > 0) && (
            <p className="text-xs mt-2 font-mono" style={{ color: "var(--pat-text)" }}>
              <span style={{ color: failed === 0 ? "var(--pat-cream)" : "#22c55e" }}>{passed} passed</span>
              {failed > 0 && <span className="ml-3" style={{ color: "#ef4444" }}>{failed} failed</span>}
              <span className="ml-3" style={{ color: "var(--pat-muted)" }}>of {total}</span>
            </p>
          )}
        </div>
        <button
          onClick={runAll}
          disabled={runningAll || tools.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: "var(--pat-cream)", color: "var(--pat-bg)" }}
        >
          {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {runningAll ? "Running…" : "Run all"}
        </button>
      </div>

      {/* Per-category tool list */}
      {CATEGORY_ORDER.map(({ id: catId, label }) => {
        const items = tools.filter((t) => t.category === catId);
        if (items.length === 0) return null;
        return (
          <div key={catId} className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--pat-muted)" }}>
              {label}
            </p>
            <div className="space-y-1.5">
              {items.map((t) => {
                const result = results[t.id];
                const isRunning = running[t.id];
                return (
                  <div
                    key={t.id}
                    className="rounded-lg border px-4 py-3 flex items-center gap-3"
                    style={{
                      background: "var(--pat-surface)",
                      borderColor: result
                        ? result.ok ? "rgba(200,169,110,0.3)" : "rgba(239,68,68,0.4)"
                        : "var(--pat-border)",
                    }}
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: result
                          ? result.ok ? "var(--pat-cream-20)" : "rgba(239,68,68,0.15)"
                          : "rgba(255,255,255,0.04)",
                      }}
                    >
                      {isRunning
                        ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--pat-cream)" }} />
                        : result?.ok
                          ? <Check className="h-4 w-4" style={{ color: "var(--pat-cream)" }} />
                          : result
                            ? <X className="h-4 w-4 text-red-400" />
                            : <Play className="h-3.5 w-3.5" style={{ color: "var(--pat-muted)" }} />
                      }
                    </div>

                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: "var(--pat-text)" }}>
                        {t.displayName}
                        <span className="ml-2 font-mono text-xs" style={{ color: "var(--pat-muted)" }}>
                          {t.id}
                        </span>
                      </div>
                      {result && (
                        <div className="text-xs mt-0.5" style={{ color: result.ok ? "var(--pat-muted)" : "#ef4444" }}>
                          {result.ok
                            ? `OK · ${result.elapsed}ms${result.file ? ` · ${result.file.filename} (${formatSize(result.file.sizeBytes)})` : ""}`
                            : `Error: ${result.error}`}
                        </div>
                      )}
                    </div>

                    {/* Download (if file generated) */}
                    {result?.file && (
                      <a
                        href={result.file.downloadUrl}
                        download={result.file.filename}
                        title="Download generated file"
                        className="p-1.5 rounded hover:bg-white/8 transition-colors"
                        style={{ color: "var(--pat-cream)" }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {/* Run button */}
                    <button
                      onClick={() => runOne(t.id)}
                      disabled={isRunning}
                      className="px-3 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderColor: "var(--pat-border)",
                        color: "var(--pat-text)",
                      }}
                    >
                      Run
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}
