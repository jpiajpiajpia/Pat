"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/app";
import { Loader2, CheckCircle2 } from "lucide-react";

export function GeneralSettings() {
  const { user, setUser } = useAppStore();
  const [name, setName] = useState(user?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(user?.settings?.systemPrompt ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setSystemPrompt(user?.settings?.systemPrompt ?? "");
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        name,
        settings: { systemPrompt },
      }),
    });
    const updated = await res.json();
    setUser(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-semibold text-zinc-100">General</h3>
        <p className="text-sm text-zinc-500 mt-0.5">Your profile and AI preferences</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Display name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-zinc-800 border-white/10 text-zinc-100 max-w-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">System prompt</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          placeholder="You are a helpful enterprise AI assistant…"
          className="bg-zinc-800 border-white/10 text-zinc-100 placeholder-zinc-600 resize-none"
        />
        <p className="text-xs text-zinc-600">This instruction is sent with every conversation.</p>
      </div>

      <div className="pt-2">
        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saved && <CheckCircle2 className="h-3.5 w-3.5" />}
          {saved ? "Saved" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
