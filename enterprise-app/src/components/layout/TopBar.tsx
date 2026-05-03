"use client";

import { Settings, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";
import { type Mode } from "@/lib/strength";

const MODES: { id: Mode; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "code", label: "Code" },
];

export function TopBar() {
  const router = useRouter();
  const { user, mode, setMode } = useAppStore();

  function handleModeSwitch(m: Mode) {
    setMode(m);
    router.push(m === "code" ? "/code" : "/chat");
  }

  return (
    <div
      className="flex items-center h-11 px-4 border-b flex-shrink-0"
      style={{ background: "var(--pat-sidebar)", borderColor: "var(--pat-border)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 w-56 flex-shrink-0">
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--pat-cream-20)" }}
        >
          <span className="font-serif text-base font-semibold" style={{ color: "var(--pat-cream)" }}>
            P
          </span>
        </div>
        <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--pat-text)" }}>
          Pat
        </span>
      </div>

      {/* Mode toggle — centered */}
      <div className="flex-1 flex justify-center">
        <div
          className="flex gap-0.5 p-0.5 rounded-xl border"
          style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--pat-border)" }}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeSwitch(m.id)}
              className={cn(
                "px-5 py-1 rounded-[10px] text-xs font-semibold tracking-widest transition-all",
                mode === m.id
                  ? "shadow-sm"
                  : "hover:opacity-80"
              )}
              style={
                mode === m.id
                  ? { background: "var(--pat-cream)", color: "var(--pat-bg)" }
                  : { color: "var(--pat-muted)" }
              }
            >
              {m.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Right: docs + settings + avatar */}
      <div className="flex items-center gap-2 w-56 justify-end flex-shrink-0">
        <button
          onClick={() => router.push("/docs")}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--pat-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-text)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          title="Documentation"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <button
          onClick={() => router.push("/settings")}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--pat-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-text)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
          style={{ background: "var(--pat-cream-20)", color: "var(--pat-cream)" }}
        >
          {user?.avatarInitials ?? "U"}
        </div>
      </div>
    </div>
  );
}
