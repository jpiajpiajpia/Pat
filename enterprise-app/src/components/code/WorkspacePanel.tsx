"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderOpen, Folder, FileText, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Entry { name: string; type: "file" | "dir"; path: string; }

interface Props {
  workspace: string;
  onFileClick?: (path: string) => void;
}

function FileNode({ entry, workspace, depth, onFileClick }: {
  entry: Entry; workspace: string; depth: number; onFileClick?: (p: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [children, setChildren] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const SKIP = new Set(["node_modules", ".next", ".git", "dist", ".cache"]);
  if (SKIP.has(entry.name)) return null;

  async function loadChildren() {
    if (loaded || loading) return;
    setLoading(true);
    const res = await fetch(`/api/code/file?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(entry.path)}&op=list`);
    const data = await res.json();
    setChildren(data as Entry[]);
    setLoaded(true);
    setLoading(false);
  }

  async function toggle() {
    if (entry.type === "file") {
      onFileClick?.(entry.path);
      return;
    }
    if (!open && !loaded) await loadChildren();
    setOpen((o) => !o);
  }

  const Icon = entry.type === "dir" ? (open ? Folder : Folder) : FileText;

  return (
    <div>
      <button
        onClick={toggle}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className="flex items-center gap-1.5 w-full py-0.5 text-left hover:bg-white/5 rounded transition-colors group"
      >
        {entry.type === "dir" ? (
          open ? <ChevronDown className="h-3 w-3 text-zinc-600 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-zinc-600 flex-shrink-0" />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", entry.type === "dir" ? "text-yellow-500/70" : "text-zinc-400")} />
        <span className="text-xs text-zinc-400 group-hover:text-zinc-200 truncate">{entry.name}</span>
        {loading && <RefreshCw className="h-2.5 w-2.5 text-zinc-600 animate-spin ml-auto" />}
      </button>
      {open && children.map((c) => (
        <FileNode key={c.path} entry={c} workspace={workspace} depth={depth + 1} onFileClick={onFileClick} />
      ))}
    </div>
  );
}

export function WorkspacePanel({ workspace, onFileClick }: Props) {
  const [root, setRoot] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRoot = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/code/file?workspace=${encodeURIComponent(workspace)}&path=.&op=list`);
      const data = await res.json();
      setRoot(data as Entry[]);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { loadRoot(); }, [loadRoot]);

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
        <FolderOpen className="h-6 w-6 text-zinc-700" />
        <p className="text-xs text-zinc-600">No workspace selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderOpen className="h-3.5 w-3.5 text-yellow-500/70 flex-shrink-0" />
          <span className="text-xs text-zinc-400 truncate" title={workspace}>
            {workspace.split("/").slice(-2).join("/")}
          </span>
        </div>
        <button onClick={loadRoot} className="p-1 hover:bg-white/10 rounded transition-colors">
          <RefreshCw className={cn("h-3 w-3 text-zinc-600", loading && "animate-spin")} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {root.map((entry) => (
          <FileNode key={entry.path} entry={entry} workspace={workspace} depth={0} onFileClick={onFileClick} />
        ))}
      </div>
    </div>
  );
}
