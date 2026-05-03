"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAppStore } from "@/store/app";
import { mutate } from "swr";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddMcpDialog({ open, onClose }: Props) {
  const { user } = useAppStore();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState("none");
  const [authValue, setAuthValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testError, setTestError] = useState("");
  const [testTools, setTestTools] = useState<Array<{ name: string; description: string }>>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  function reset() {
    setName(""); setUrl(""); setAuthType("none"); setAuthValue("");
    setTestState("idle"); setTestError(""); setTestTools([]); setSavedId(null);
  }

  async function handleSave() {
    if (!user || !name || !url) return;
    setSaving(true);
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, name, url, authType, authValue: authValue || null }),
    });
    const server = await res.json();
    setSavedId(server.id);
    mutate(`/api/mcp?userId=${user.id}`);
    setSaving(false);
  }

  async function handleTest() {
    if (!savedId) {
      await handleSave();
    }
    if (!savedId) return;
    setTestState("testing");
    setTestError("");
    try {
      const res = await fetch(`/api/mcp/${savedId}/test`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTestState("ok");
        setTestTools(data.tools ?? []);
      } else {
        setTestState("error");
        setTestError(data.error ?? "Connection failed");
      }
    } catch (err) {
      setTestState("error");
      setTestError(String(err));
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-zinc-900 border-white/10 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Salesforce CRM" className="bg-zinc-800 border-white/10 text-zinc-100 placeholder-zinc-600" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs">Server URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.yourapp.com/mcp" className="bg-zinc-800 border-white/10 text-zinc-100 placeholder-zinc-600" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs">Authentication</Label>
            <Select value={authType} onValueChange={(v) => setAuthType(v ?? "none")}>
              <SelectTrigger className="bg-zinc-800 border-white/10 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-white/10 text-zinc-100">
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="bearer">Bearer token</SelectItem>
                <SelectItem value="apikey">API key</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {authType !== "none" && (
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">{authType === "bearer" ? "Token" : "API Key"}</Label>
              <Input value={authValue} onChange={(e) => setAuthValue(e.target.value)} type="password" placeholder="••••••••" className="bg-zinc-800 border-white/10 text-zinc-100 placeholder-zinc-600" />
            </div>
          )}

          {/* Test result */}
          {testState === "ok" && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                <CheckCircle2 className="h-4 w-4" />
                Connected — {testTools.length} tool{testTools.length !== 1 ? "s" : ""} discovered
              </div>
              <div className="space-y-1">
                {testTools.map((t) => (
                  <div key={t.name} className="text-xs text-zinc-400">
                    <span className="text-zinc-300 font-mono">{t.name}</span>
                    {t.description && <span className="text-zinc-600"> — {t.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {testState === "error" && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{testError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!name || !url || testState === "testing"}
            className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
          >
            {testState === "testing" && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            {savedId ? "Test connection" : "Save & test"}
          </Button>
          {savedId && testState !== "idle" && (
            <Button onClick={handleClose} className="bg-indigo-600 hover:bg-indigo-500">
              Done
            </Button>
          )}
          {!savedId && (
            <Button onClick={handleSave} disabled={!name || !url || saving} className="bg-indigo-600 hover:bg-indigo-500">
              {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
