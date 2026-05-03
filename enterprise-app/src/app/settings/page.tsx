"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Wrench, Brain, Cpu, Sliders, Database, Info, Server, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { McpServerList } from "@/components/settings/McpServerList";
import { MemorySettings } from "@/components/settings/MemorySettings";
import { DependenciesPanel } from "@/components/settings/DependenciesPanel";
import { ModelsPanel } from "@/components/settings/ModelsPanel";
import { DataControlsPanel } from "@/components/settings/DataControlsPanel";
import { AboutPanel } from "@/components/settings/AboutPanel";
import { ToolsPanel } from "@/components/settings/ToolsPanel";

type Tab = "general" | "models" | "dependencies" | "tools" | "mcp" | "memory" | "data" | "about";

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ElementType;
  group: "core" | "data" | "system";
  description?: string;
}

const tabs: TabDef[] = [
  { id: "general",      label: "General",      icon: User,    group: "core" },
  { id: "models",       label: "Models",       icon: Sliders, group: "core" },
  { id: "dependencies", label: "Dependencies", icon: Cpu,     group: "core" },
  { id: "tools",        label: "Tools",        icon: Hammer,  group: "data" },
  { id: "mcp",          label: "MCP Servers",  icon: Wrench,  group: "data" },
  { id: "memory",       label: "Memory",       icon: Brain,   group: "data" },
  { id: "data",         label: "Data Controls", icon: Database, group: "data" },
  { id: "about",        label: "About",        icon: Info,    group: "system" },
];

const TAB_TITLES: Record<Tab, string> = {
  general: "General",
  models: "Models",
  dependencies: "Dependencies",
  tools: "Tools",
  mcp: "MCP Servers",
  memory: "Memory",
  data: "Data Controls",
  about: "About",
};

const TAB_SUBTITLES: Record<Tab, string> = {
  general: "Account name, theme, and the system prompt the AI uses for every conversation.",
  models: "Pick the default model for Chat and Code. You can override per-message from the model selector.",
  dependencies: "Check that Ollama is running and install the models Nexus uses for chat, code, reasoning, vision, and memory.",
  tools: "Built-in capabilities the AI can call from both Chat and Code Agent — generating PDFs, Word docs, presentations, spreadsheets, fetching URLs, and more.",
  mcp: "Connect external tools via the Model Context Protocol — Salesforce, Gong, Slack, custom services, or anything that speaks MCP.",

  memory: "Long-term, semantic memory powered by local embeddings. The AI uses these automatically when relevant.",
  data: "Export your data or wipe local conversations and code sessions.",
  about: "Build info, runtime status, and privacy details.",
};

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("general");

  const groupOrder = ["core", "data", "system"] as const;
  const groupLabels: Record<typeof groupOrder[number], string> = {
    core: "Setup",
    data: "Data & Connections",
    system: "System",
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Settings sidebar */}
      <div className="w-56 border-r flex-shrink-0 flex flex-col" style={{ background: "var(--pat-sidebar)", borderColor: "var(--pat-border)" }}>
        <div className="p-4 pb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs transition-colors mb-6"
            style={{ color: "var(--pat-muted)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {groupOrder.map((g) => {
            const items = tabs.filter((t) => t.group === g);
            return (
              <div key={g}>
                <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1.5" style={{ color: "var(--pat-muted)" }}>
                  {groupLabels[g]}
                </p>
                <nav className="space-y-0.5">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors text-left"
                      )}
                      style={
                        tab === t.id
                          ? { background: "var(--pat-cream-10)", color: "var(--pat-text)" }
                          : { color: "var(--pat-muted)" }
                      }
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  ))}
                </nav>
              </div>
            );
          })}
        </div>
        <div className="border-t p-3 flex items-center gap-2 text-xs" style={{ borderColor: "var(--pat-border)", color: "var(--pat-muted)" }}>
          <Server className="h-3 w-3" />
          <span>Pat · v1.3.0</span>
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-10 py-10">
          {/* Section header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--pat-text)" }}>{TAB_TITLES[tab]}</h1>
            <p className="text-sm mt-1.5 max-w-xl" style={{ color: "var(--pat-muted)" }}>{TAB_SUBTITLES[tab]}</p>
          </div>

          {tab === "general"      && <GeneralSettings />}
          {tab === "models"       && <ModelsPanel />}
          {tab === "dependencies" && <DependenciesPanel />}
          {tab === "tools"        && <ToolsPanel />}
          {tab === "mcp"          && <McpServerList />}
          {tab === "memory"       && <MemorySettings />}
          {tab === "data"         && <DataControlsPanel />}
          {tab === "about"        && <AboutPanel />}
        </div>
      </div>
    </div>
  );
}
