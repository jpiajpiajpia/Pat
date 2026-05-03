"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Plus, Trash2, ToggleLeft, ToggleRight, Wrench, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddMcpDialog } from "./AddMcpDialog";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

interface McpServer {
  id: string;
  name: string;
  url: string;
  authType: string;
  enabled: boolean;
  tools: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function McpServerList() {
  const { user } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const { data: servers = [], isLoading } = useSWR<McpServer[]>(
    user ? `/api/mcp?userId=${user.id}` : null,
    fetcher
  );

  async function toggleEnabled(server: McpServer) {
    await fetch(`/api/mcp/${server.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !server.enabled }),
    });
    mutate(`/api/mcp?userId=${user?.id}`);
  }

  async function deleteServer(id: string) {
    await fetch(`/api/mcp/${id}`, { method: "DELETE" });
    mutate(`/api/mcp?userId=${user?.id}`);
  }

  async function refreshTools(id: string) {
    setRefreshing(id);
    await fetch(`/api/mcp/${id}/test`, { method: "POST" });
    mutate(`/api/mcp?userId=${user?.id}`);
    setRefreshing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">MCP Servers</h3>
          <p className="text-sm text-zinc-500 mt-0.5">Connect external tools and data sources via Model Context Protocol</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-500 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add server
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-zinc-600">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : servers.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-xl p-8 text-center">
          <Wrench className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No MCP servers connected yet</p>
          <p className="text-xs text-zinc-600 mt-1">Add a server to give Nexus access to your business tools</p>
          <Button onClick={() => setDialogOpen(true)} size="sm" variant="outline" className="mt-4 border-white/10 text-zinc-300">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add your first server
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => {
            const tools = server.tools ? JSON.parse(server.tools) as Array<{ name: string }> : [];
            return (
              <div key={server.id} className={cn("border rounded-xl p-4 transition-all", server.enabled ? "border-white/10 bg-zinc-800/50" : "border-white/5 bg-zinc-900/50 opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-200 text-sm">{server.name}</span>
                      {tools.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md">
                          {tools.length} tool{tools.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{server.url}</p>
                    {tools.length > 0 && (
                      <p className="text-xs text-zinc-600 mt-1">{tools.map((t) => t.name).join(" · ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => refreshTools(server.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors" title="Refresh tools">
                      {refreshing === server.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => toggleEnabled(server)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors">
                      {server.enabled ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => deleteServer(server.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddMcpDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
