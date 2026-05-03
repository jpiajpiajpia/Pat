"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Brain, Trash2, Plus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Memory {
  id: string;
  content: string;
  source: string;
  score?: number;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function MemorySettings() {
  const { user } = useAppStore();
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null);
  const [searching, setSearching] = useState(false);

  const { data: memories, isLoading } = useSWR<Memory[]>(
    user ? `/api/memory?userId=${user.id}` : null,
    fetcher
  );

  async function handleSave() {
    if (!user || !newContent.trim()) return;
    setSaving(true);
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, content: newContent.trim() }),
    });
    setNewContent("");
    mutate(`/api/memory?userId=${user.id}`);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    await fetch(`/api/memory/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    mutate(`/api/memory?userId=${user.id}`);
    if (searchResults) {
      setSearchResults(searchResults.filter((m) => m.id !== id));
    }
  }

  async function handleSearch() {
    if (!user || !searchQuery.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/memory?userId=${user.id}&q=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setSearchResults(data);
    setSearching(false);
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults(null);
  }

  const displayed = searchResults ?? memories ?? [];

  return (
    <div className="space-y-6">
      {/* Add memory */}
      <div className="rounded-xl border border-white/10 bg-zinc-900 p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Add memory</h3>
        </div>
        <p className="text-xs text-zinc-500">
          Store anything you want the AI to remember — preferences, context, facts about your work.
          It will be retrieved automatically when relevant.
        </p>
        <Textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="e.g. Our Salesforce org uses custom fields for pipeline stage tracking..."
          rows={3}
          className="bg-zinc-800 border-white/10 text-zinc-100 placeholder-zinc-600 resize-none"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!newContent.trim() || saving}
            className="bg-indigo-600 hover:bg-indigo-500 h-8 text-xs"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            Save memory
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Semantic search memories..."
          className="bg-zinc-800 border-white/10 text-zinc-100 placeholder-zinc-600"
        />
        <Button
          variant="outline"
          onClick={handleSearch}
          disabled={!searchQuery.trim() || searching}
          className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 shrink-0"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        {searchResults && (
          <Button variant="ghost" onClick={clearSearch} className="text-zinc-500 hover:text-zinc-200 shrink-0 text-xs">
            Clear
          </Button>
        )}
      </div>

      {searchResults && (
        <p className="text-xs text-zinc-500">
          {searchResults.length === 0
            ? "No memories matched that query."
            : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} — ranked by semantic similarity`}
        </p>
      )}

      {/* Memory list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
          </div>
        ) : displayed.length === 0 && !searchResults ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
            <Brain className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No memories yet.</p>
            <p className="text-xs text-zinc-600 mt-1">Add one above or keep chatting — the AI can save memories from conversations.</p>
          </div>
        ) : (
          displayed.map((m) => (
            <div
              key={m.id}
              className="group flex items-start gap-3 rounded-lg border border-white/10 bg-zinc-900 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 leading-relaxed">{m.content}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-mono",
                    m.source === "conversation"
                      ? "bg-violet-500/10 text-violet-400"
                      : "bg-zinc-800 text-zinc-500"
                  )}>
                    {m.source}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                  </span>
                  {m.score !== undefined && (
                    <span className="text-xs text-emerald-500 font-mono">
                      {(m.score * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 p-1 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
