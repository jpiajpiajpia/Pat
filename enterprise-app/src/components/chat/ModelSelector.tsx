"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { ChevronDown, Sparkles, Code2, Brain, Eye, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DepModel {
  id: string;
  displayName: string;
  role: string;
  installed: boolean;
}
interface DepStatus { models: DepModel[]; }

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ROLE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  chat:      { icon: Sparkles, color: "text-indigo-400" },
  code:      { icon: Code2,    color: "text-emerald-400" },
  reasoning: { icon: Brain,    color: "text-violet-400" },
  vision:    { icon: Eye,      color: "text-cyan-400" },
};

interface Props {
  value: string;                      // currently selected model id
  onChange: (id: string) => void;
  filter: (m: DepModel) => boolean;   // which models to allow (installed + relevant role)
  align?: "left" | "right";
}

export function ModelSelector({ value, onChange, filter, align = "right" }: Props) {
  const { data } = useSWR<DepStatus>("/api/dependencies", fetcher, { refreshInterval: 10000 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const models = (data?.models ?? []).filter((m) => m.installed && filter(m));
  const current = models.find((m) => m.id === value);
  const RoleIcon = current ? ROLE_ICONS[current.role]?.icon ?? Sparkles : Sparkles;
  const roleColor = current ? ROLE_ICONS[current.role]?.color ?? "text-zinc-400" : "text-zinc-500";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 h-7 pl-1.5 pr-1.5 rounded-lg text-xs transition-colors",
          "hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
        )}
        title="Choose model"
      >
        <RoleIcon className={cn("h-3 w-3", roleColor)} />
        <span className="font-mono max-w-[150px] truncate">{current?.displayName ?? value}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className={cn(
          "absolute bottom-full mb-1.5 z-50 min-w-[260px] rounded-xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden",
          align === "right" ? "right-0" : "left-0"
        )}>
          {models.length === 0 ? (
            <div className="px-4 py-3 text-xs text-zinc-500">
              No installed models. Install one in Settings → Dependencies.
            </div>
          ) : (
            <div className="py-1 max-h-[320px] overflow-y-auto">
              {models.map((m) => {
                const Icon = ROLE_ICONS[m.role]?.icon ?? Sparkles;
                const color = ROLE_ICONS[m.role]?.color ?? "text-zinc-400";
                const selected = m.id === value;
                return (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.id); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                      selected ? "bg-white/5" : "hover:bg-white/5"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-100">{m.displayName}</div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate">{m.id}</div>
                    </div>
                    {selected && <Check className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
