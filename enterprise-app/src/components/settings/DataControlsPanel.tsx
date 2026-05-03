"use client";

import { useState } from "react";
import { Download, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app";

export function DataControlsPanel() {
  const { user } = useAppStore();
  const [exporting, setExporting] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  async function exportConversations() {
    if (!user) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/conversations?userId=${user.id}`);
      const conversations = await res.json();

      // For each conversation, fetch full messages
      const full = await Promise.all(
        (conversations as Array<{ id: string }>).map(async (c) => {
          const r = await fetch(`/api/conversations/${c.id}`);
          return r.json();
        })
      );

      const blob = new Blob([JSON.stringify(full, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-conversations-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function wipeAll() {
    if (!user) return;
    setWiping(true);
    try {
      const res = await fetch(`/api/conversations?userId=${user.id}`);
      const conversations = await res.json();
      await Promise.all(
        (conversations as Array<{ id: string }>).map((c) =>
          fetch(`/api/conversations/${c.id}`, { method: "DELETE" })
        )
      );
      const codeRes = await fetch(`/api/code/sessions?userId=${user.id}`);
      const codeSessions = await codeRes.json();
      await Promise.all(
        (codeSessions as Array<{ id: string }>).map((c) =>
          fetch(`/api/code/sessions/${c.id}`, { method: "DELETE" })
        )
      );
      setConfirmWipe(false);
    } finally {
      setWiping(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="rounded-xl border border-white/10 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">Export conversations</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Download all your chat conversations and messages as a JSON file. Code sessions and memories not included.
        </p>
        <Button
          onClick={exportConversations}
          disabled={exporting}
          variant="outline"
          className="border-white/10 text-zinc-200 hover:bg-white/5"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-2" />
          )}
          Export JSON
        </Button>
      </div>

      {/* Wipe */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-start gap-3 mb-1">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <h3 className="text-sm font-semibold text-red-300">Wipe all conversations and code sessions</h3>
        </div>
        <p className="text-xs text-zinc-400 mb-4 ml-7">
          Permanently delete every chat conversation and code session. Memories, MCP servers, and your account remain.
          This cannot be undone.
        </p>
        <div className="ml-7 flex items-center gap-2">
          {confirmWipe ? (
            <>
              <Button
                onClick={wipeAll}
                disabled={wiping}
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                {wiping && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Yes, delete everything
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmWipe(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setConfirmWipe(true)}
              variant="outline"
              className="border-red-500/30 text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Wipe data…
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
