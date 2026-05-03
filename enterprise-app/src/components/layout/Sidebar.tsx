"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Trash2, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { isToday, isYesterday, subDays, isAfter } from "date-fns";
import useSWR, { mutate } from "swr";

interface Conversation { id: string; title: string; updatedAt: string; }
interface CodeSession { id: string; title: string; updatedAt: string; }

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, mode, sidebarOpen, toggleSidebar } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  // Routes with their own sidebar (settings, docs) should suppress the session sidebar
  if (pathname?.startsWith("/settings") || pathname?.startsWith("/docs")) {
    return null;
  }

  const { data: conversations = [] } = useSWR<Conversation[]>(
    user && mode === "chat" ? `/api/conversations?userId=${user.id}` : null,
    fetcher,
    { refreshInterval: 8000, revalidateOnFocus: true }
  );

  const { data: codeSessions = [] } = useSWR<CodeSession[]>(
    user && mode === "code" ? `/api/code/sessions?userId=${user.id}` : null,
    fetcher,
    { refreshInterval: 8000, revalidateOnFocus: true }
  );

  async function handleNew() {
    if (!user || creating) return;
    setCreating(true);
    if (mode === "chat") {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, mode: "chat" }),
      });
      const conv = await res.json();
      mutate(`/api/conversations?userId=${user.id}`);
      router.push(`/chat/${conv.id}`);
    } else {
      const res = await fetch("/api/code/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const session = await res.json();
      mutate(`/api/code/sessions?userId=${user.id}`);
      router.push(`/code/${session.id}`);
    }
    setCreating(false);
  }

  async function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    mutate(`/api/conversations?userId=${user?.id}`);
    if (pathname === `/chat/${id}`) router.push("/chat");
  }

  async function deleteCodeSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/code/sessions/${id}`, { method: "DELETE" });
    mutate(`/api/code/sessions?userId=${user?.id}`);
    if (pathname === `/code/${id}`) router.push("/code");
  }

  function groupByDate<T extends { updatedAt: string; title: string }>(items: T[]) {
    const filtered = search
      ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
      : items;
    const now = new Date();
    const groups: Record<string, T[]> = { Today: [], Yesterday: [], "This week": [], Older: [] };
    for (const item of filtered) {
      const d = new Date(item.updatedAt);
      if (isToday(d)) groups["Today"].push(item);
      else if (isYesterday(d)) groups["Yesterday"].push(item);
      else if (isAfter(d, subDays(now, 7))) groups["This week"].push(item);
      else groups["Older"].push(item);
    }
    return groups;
  }

  if (!sidebarOpen) {
    return (
      <div
        className="flex flex-col items-center py-3 px-2 gap-2 border-r flex-shrink-0 w-12"
        style={{ background: "var(--pat-sidebar)", borderColor: "var(--pat-border)" }}
      >
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--pat-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-text)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-muted)"; }}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button
          onClick={handleNew}
          className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--pat-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-text)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-muted)"; }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const items = mode === "chat" ? conversations : codeSessions;
  const groups = groupByDate(items);

  return (
    <div
      className="flex flex-col h-full w-56 border-r flex-shrink-0"
      style={{ background: "var(--pat-sidebar)", borderColor: "var(--pat-border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg transition-colors flex-shrink-0"
          style={{ color: "var(--pat-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-text)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--pat-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleNew}
          disabled={creating}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--pat-border)", color: "var(--pat-text)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
        >
          <Plus className="h-3 w-3" />
          New {mode === "code" ? "task" : "chat"}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border"
          style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--pat-border)" }}
        >
          <Search className="h-3 w-3 flex-shrink-0" style={{ color: "var(--pat-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 bg-transparent text-xs outline-none placeholder-[--pat-muted]"
            style={{ color: "var(--pat-text)" }}
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
        {Object.entries(groups).map(([group, groupItems]) =>
          groupItems.length === 0 ? null : (
            <div key={group}>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1"
                style={{ color: "var(--pat-muted)" }}
              >
                {group}
              </p>
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const href = mode === "chat" ? `/chat/${item.id}` : `/code/${item.id}`;
                  const active = pathname === href;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => { if (e.key === "Enter") router.push(href); }}
                      className={cn(
                        "group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer"
                      )}
                      style={
                        active
                          ? { background: "var(--pat-cream-10)", color: "var(--pat-text)" }
                          : { color: "var(--pat-muted)" }
                      }
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLElement).style.color = "var(--pat-text)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "var(--pat-muted)";
                        }
                      }}
                    >
                      <span className="flex-1 text-xs truncate">{item.title}</span>
                      <button
                        onClick={(e) =>
                          mode === "chat"
                            ? deleteChat((item as Conversation).id, e)
                            : deleteCodeSession((item as CodeSession).id, e)
                        }
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all hover:text-red-400"
                        style={{ color: "var(--pat-muted)" }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
        {items.length === 0 && !search && (
          <p className="text-xs text-center mt-10 px-4" style={{ color: "var(--pat-muted)" }}>
            {mode === "code" ? "No coding tasks yet" : "No conversations yet"}
          </p>
        )}
      </div>
    </div>
  );
}
