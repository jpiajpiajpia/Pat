"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/app";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Conversation { id: string; title: string; updatedAt: string; }

export default function ChatPage() {
  const { user } = useAppStore();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  // Load existing conversations and redirect to the most recent one if any exist.
  // Do NOT auto-create — that caused a new empty conversation every navigation.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/conversations?userId=${user.id}`)
      .then((r) => r.json())
      .then((data: Conversation[]) => {
        if (cancelled) return;
        if (data.length > 0) {
          router.replace(`/chat/${data[0].id}`);
        } else {
          setConversations([]);
        }
      });
    return () => { cancelled = true; };
  }, [user, router]);

  async function startNew() {
    if (!user || creating) return;
    setCreating(true);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, mode: "chat" }),
    });
    const conv = await res.json();
    router.replace(`/chat/${conv.id}`);
  }

  // Loading state — we're checking for existing conversations
  if (conversations === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="text-center max-w-sm">
        <div className="h-14 w-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="h-7 w-7 text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-200">Start a new chat</h2>
        <p className="text-sm text-zinc-500 mt-1.5 mb-5">
          Ask Nexus anything. Pick a model from the input bar — chat, reasoning, or vision.
        </p>
        <Button
          onClick={startNew}
          disabled={creating}
          className="bg-indigo-600 hover:bg-indigo-500"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
          New chat
        </Button>
      </div>
    </div>
  );
}
