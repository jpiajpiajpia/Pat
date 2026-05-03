"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { Plus, Trash2, Save, X, FileText, Edit3 } from "lucide-react";

interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  path: string;
  updatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STARTER_BODY = `Describe what this skill should do. The body becomes a system-prompt addition that's active when the user invokes this skill from the + menu.

Examples:
- "When the user shares code, review it for security issues, performance, and best practices."
- "Always respond in the voice of a friendly elementary school teacher."
- "Format every response as Markdown with clear headings and bullet points."

You can write multi-paragraph instructions, examples, formatting guidelines — anything that helps the model do this task well.`;

export function SkillsPanel() {
  const { data, error } = useSWR<{ skills: Skill[] }>("/api/skills", fetcher);
  const [editing, setEditing] = useState<Skill | "new" | null>(null);

  if (error) return <div className="text-sm text-red-400">Failed to load skills.</div>;
  const skills = data?.skills ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--pat-muted)" }}>
          {skills.length} skill{skills.length === 1 ? "" : "s"} · stored as Markdown in <code className="font-mono" style={{ color: "var(--pat-cream)" }}>~/Library/Application Support/nexus/skills/</code>
        </p>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: "var(--pat-cream)", color: "var(--pat-bg)" }}
        >
          <Plus className="h-3.5 w-3.5" /> New skill
        </button>
      </div>

      {editing && (
        <SkillEditor
          skill={editing === "new" ? null : editing}
          onSaved={() => { setEditing(null); mutate("/api/skills"); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {skills.length === 0 && !editing && (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)" }}
        >
          <div
            className="h-12 w-12 mx-auto rounded-xl flex items-center justify-center mb-3"
            style={{ background: "var(--pat-cream-20)" }}
          >
            <FileText className="h-6 w-6" style={{ color: "var(--pat-cream)" }} />
          </div>
          <p className="text-sm" style={{ color: "var(--pat-text)" }}>No skills yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--pat-muted)" }}>
            Skills are reusable prompt-additions you can call from the + menu in Chat or Code.
          </p>
        </div>
      )}

      {skills.length > 0 && (
        <div className="space-y-1.5">
          {skills.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border px-4 py-3 flex items-center gap-3"
              style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)" }}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--pat-cream-20)" }}
              >
                <FileText className="h-4 w-4" style={{ color: "var(--pat-cream)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: "var(--pat-text)" }}>{s.name}</div>
                <div className="text-xs truncate" style={{ color: "var(--pat-muted)" }}>{s.description || "(no description)"}</div>
              </div>
              <button
                onClick={() => setEditing(s)}
                title="Edit"
                className="p-1.5 rounded hover:bg-white/8"
                style={{ color: "var(--pat-muted)" }}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete skill "${s.name}"?`)) return;
                  await fetch(`/api/skills/${s.id}`, { method: "DELETE" });
                  mutate("/api/skills");
                }}
                title="Delete"
                className="p-1.5 rounded hover:bg-white/8 hover:text-red-400"
                style={{ color: "var(--pat-muted)" }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillEditor({
  skill,
  onSaved,
  onCancel,
}: {
  skill: Skill | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [body, setBody] = useState(skill?.body ?? STARTER_BODY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setDescription(skill.description);
      setBody(skill.body);
    }
  }, [skill]);

  async function save() {
    if (!name.trim()) { setErr("Name required"); return; }
    setSaving(true);
    setErr(null);
    try {
      const url = skill ? `/api/skills/${skill.id}` : "/api/skills";
      const method = skill ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, body }),
      });
      if (!res.ok) { setErr(`Save failed (${res.status})`); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{ background: "var(--pat-surface)", borderColor: "rgba(200,169,110,0.3)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--pat-text)" }}>
          {skill ? `Edit: ${skill.name}` : "New skill"}
        </h3>
        <button
          onClick={onCancel}
          className="p-1.5 rounded hover:bg-white/8"
          style={{ color: "var(--pat-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--pat-muted)" }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Code Review"
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-[var(--pat-cream)]"
            style={{ background: "var(--pat-bg)", borderColor: "var(--pat-border)", color: "var(--pat-text)" }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--pat-muted)" }}>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One line — what does this skill do?"
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-[var(--pat-cream)]"
            style={{ background: "var(--pat-bg)", borderColor: "var(--pat-border)", color: "var(--pat-text)" }}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--pat-muted)" }}>Skill body (Markdown)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border outline-none focus:border-[var(--pat-cream)] resize-y leading-relaxed"
            style={{ background: "var(--pat-bg)", borderColor: "var(--pat-border)", color: "var(--pat-text)" }}
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--pat-muted)" }}>
            This Markdown is injected into the system prompt when the skill is active. Use it to give the model persona, formatting rules, focus areas, etc.
          </p>
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg border"
            style={{ background: "transparent", borderColor: "var(--pat-border)", color: "var(--pat-text)" }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50"
            style={{ background: "var(--pat-cream)", color: "var(--pat-bg)" }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
