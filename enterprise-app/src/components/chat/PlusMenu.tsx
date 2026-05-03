"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Paperclip, Sparkles, Wrench, Check, ExternalLink, Loader2 } from "lucide-react";
import useSWR from "swr";

interface Skill { id: string; name: string; description: string; }
interface McpServer { id: string; name: string; url: string; enabled: boolean; }

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  /** Optional — only render the Add Files row when provided. (Code mode omits.) */
  onAddFiles?: () => void;
  /** Currently active skill IDs (for showing checkmarks) */
  activeSkillIds: Set<string>;
  /** Toggle a skill's active state */
  onToggleSkill: (skill: Skill) => void;
  /** Currently active MCP server IDs */
  activeMcpIds: Set<string>;
  /** Toggle an MCP hint */
  onToggleMcp: (server: McpServer) => void;
  /** User clicked "Manage skills" or "Manage MCP" */
  onManageSkills: () => void;
  onManageMcp: () => void;
}

export function PlusMenu({
  onAddFiles, activeSkillIds, onToggleSkill,
  activeMcpIds, onToggleMcp, onManageSkills, onManageMcp,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: skillsData, isLoading: skillsLoading } = useSWR<{ skills: Skill[] }>(
    open ? "/api/skills" : null, fetcher
  );
  const { data: mcpData, isLoading: mcpLoading } = useSWR<McpServer[]>(
    open ? "/api/mcp" : null, fetcher
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const skills = skillsData?.skills ?? [];
  const mcps = (mcpData ?? []).filter((m) => m.enabled);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-all mb-0.5"
        style={{
          color: open ? "var(--pat-text)" : "var(--pat-muted)",
          background: open ? "rgba(255,255,255,0.06)" : "transparent",
        }}
        title="Add files, skills, or MCP servers"
      >
        <Plus className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border shadow-2xl overflow-hidden z-50"
          style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)" }}
        >
          {/* Add files (chat only) */}
          {onAddFiles && (
            <button
              onClick={() => { onAddFiles(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
              style={{ color: "var(--pat-text)" }}
            >
              <Paperclip className="h-4 w-4" style={{ color: "var(--pat-muted)" }} />
              <span>Add files</span>
            </button>
          )}

          {/* Skills */}
          <div className={onAddFiles ? "border-t" : ""} style={{ borderColor: "var(--pat-border)" }}>
            <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
              <Sparkles className="h-3 w-3" style={{ color: "var(--pat-cream)" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--pat-muted)" }}>
                Skills
              </span>
            </div>
            {skillsLoading && (
              <div className="px-4 py-2 flex items-center gap-2 text-xs" style={{ color: "var(--pat-muted)" }}>
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            )}
            {!skillsLoading && skills.length === 0 && (
              <div className="px-4 py-2 text-xs" style={{ color: "var(--pat-muted)" }}>
                No skills yet. Create one in settings.
              </div>
            )}
            {skills.slice(0, 6).map((s) => {
              const active = activeSkillIds.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => onToggleSkill(s)}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-white/5 transition-colors"
                  style={{ color: "var(--pat-text)" }}
                  title={s.description}
                >
                  <span className="flex-1 truncate">{s.name}</span>
                  {active && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--pat-cream)" }} />}
                </button>
              );
            })}
            <button
              onClick={() => { onManageSkills(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-xs hover:bg-white/5 transition-colors"
              style={{ color: "var(--pat-muted)" }}
            >
              <ExternalLink className="h-3 w-3" />
              <span>Manage skills</span>
            </button>
          </div>

          {/* MCP servers */}
          <div className="border-t" style={{ borderColor: "var(--pat-border)" }}>
            <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
              <Wrench className="h-3 w-3" style={{ color: "var(--pat-cream)" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--pat-muted)" }}>
                MCP Servers
              </span>
            </div>
            {mcpLoading && (
              <div className="px-4 py-2 flex items-center gap-2 text-xs" style={{ color: "var(--pat-muted)" }}>
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            )}
            {!mcpLoading && mcps.length === 0 && (
              <div className="px-4 py-2 text-xs" style={{ color: "var(--pat-muted)" }}>
                No connected servers. Add one in settings.
              </div>
            )}
            {mcps.slice(0, 8).map((m) => {
              const active = activeMcpIds.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => onToggleMcp(m)}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-white/5 transition-colors"
                  style={{ color: "var(--pat-text)" }}
                  title={m.url}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: "#22c55e" }}
                  />
                  <span className="flex-1 truncate">{m.name}</span>
                  {active && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--pat-cream)" }} />}
                </button>
              );
            })}
            <button
              onClick={() => { onManageMcp(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-xs hover:bg-white/5 transition-colors"
              style={{ color: "var(--pat-muted)" }}
            >
              <ExternalLink className="h-3 w-3" />
              <span>Manage servers</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
