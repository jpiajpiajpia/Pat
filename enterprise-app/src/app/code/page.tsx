"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/app";
import { Code2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Session { id: string; title: string; updatedAt: string; }

export default function CodePage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/code/sessions?userId=${user.id}`)
      .then((r) => r.json())
      .then((data: Session[]) => {
        if (cancelled) return;
        if (data.length > 0) {
          router.replace(`/code/${data[0].id}`);
        } else {
          setSessions([]);
        }
      });
    return () => { cancelled = true; };
  }, [user, router]);

  async function startNew() {
    if (!user || creating) return;
    setCreating(true);
    const res = await fetch("/api/code/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const session = await res.json();
    router.replace(`/code/${session.id}`);
  }

  if (sessions === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="text-center max-w-sm">
        <div className="h-14 w-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center mx-auto mb-4">
          <Code2 className="h-7 w-7 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-200">Start a coding task</h2>
        <p className="text-sm text-zinc-500 mt-1.5 mb-5">
          Point Nexus at a workspace and describe what to build. The agent reads, writes, and edits files.
        </p>
        <Button
          onClick={startNew}
          disabled={creating}
          className="bg-emerald-700 hover:bg-emerald-600"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
          New task
        </Button>
      </div>
    </div>
  );
}
