"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Sparkles, Code2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app";

interface DepModel {
  id: string;
  displayName: string;
  role: string;
  description: string;
  installed: boolean;
}
interface DepStatus { models: DepModel[]; }

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ModelPickerProps {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  options: DepModel[];
  value: string;
  onChange: (id: string) => void;
  description: string;
}

function ModelPicker({ label, icon: Icon, iconColor, options, value, onChange, description }: ModelPickerProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <h3 className="text-sm font-semibold text-zinc-100">{label}</h3>
      </div>
      <p className="text-xs text-zinc-500 mb-4">{description}</p>

      {options.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
          <p className="text-xs text-amber-300">No installed models in this category. Install one from the Dependencies tab.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {options.map((m) => (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              className={cn(
                "w-full text-left rounded-lg border px-3 py-2.5 transition-all",
                value === m.id
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-white/10 bg-zinc-950 hover:border-white/20"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "h-4 w-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                  value === m.id ? "border-indigo-400" : "border-zinc-600"
                )}>
                  {value === m.id && <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">{m.displayName}</span>
                    <span className="text-xs text-zinc-600 font-mono">{m.id}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{m.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModelsPanel() {
  const { user, setUser } = useAppStore();
  const { data: deps } = useSWR<DepStatus>("/api/dependencies", fetcher);

  const [chatModel, setChatModel] = useState(user?.settings?.defaultChatModel ?? "mistral:7b");
  const [codeModel, setCodeModel] = useState(user?.settings?.defaultCodeModel ?? "qwen2.5-coder:7b");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    if (user?.settings?.defaultChatModel) setChatModel(user.settings.defaultChatModel);
    if (user?.settings?.defaultCodeModel) setCodeModel(user.settings.defaultCodeModel);
  }, [user?.settings?.defaultChatModel, user?.settings?.defaultCodeModel]);

  const installedChatLike = (deps?.models ?? []).filter(
    (m) => m.installed && (m.role === "chat" || m.role === "reasoning" || m.role === "vision")
  );
  const installedCode = (deps?.models ?? []).filter(
    (m) => m.installed && (m.role === "code" || m.role === "reasoning")
  );

  const dirty =
    chatModel !== (user?.settings?.defaultChatModel ?? "mistral:7b") ||
    codeModel !== (user?.settings?.defaultCodeModel ?? "qwen2.5-coder:7b");

  async function save() {
    if (!user) return;
    setSaving(true);
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        settings: { defaultChatModel: chatModel, defaultCodeModel: codeModel },
      }),
    });
    const updated = await res.json();
    setUser(updated);
    setSavedAt(Date.now());
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <ModelPicker
        label="Default Chat model"
        icon={Sparkles}
        iconColor="text-indigo-400"
        options={installedChatLike}
        value={chatModel}
        onChange={setChatModel}
        description="Used when you start a new conversation. You can also pick a different model per message from the chat input."
      />

      <ModelPicker
        label="Default Code model"
        icon={Code2}
        iconColor="text-emerald-400"
        options={installedCode}
        value={codeModel}
        onChange={setCodeModel}
        description="Used by the Code Agent for generating and editing files."
      />

      <div className="flex items-center justify-end gap-3">
        {savedAt > 0 && Date.now() - savedAt < 3000 && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        <Button
          onClick={save}
          disabled={!dirty || saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
