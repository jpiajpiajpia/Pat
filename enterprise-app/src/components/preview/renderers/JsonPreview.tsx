"use client";

import { useEffect, useState } from "react";
import { fetchText } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";
import { Loader2, ChevronRight, ChevronDown } from "lucide-react";

export function JsonPreview({ file }: { file: PreviewFile }) {
  const [text, setText] = useState<string | null>(file.text ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (text !== null) return;
    fetchText(file).then(setText).catch((e) => setError(String(e)));
  }, [file, text]);

  if (error) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (text === null) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pat-cream)" }} />
      </div>
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return (
      <div className="h-full w-full p-6 overflow-auto" style={{ background: "var(--pat-bg)", color: "var(--pat-text)" }}>
        <p className="text-xs text-amber-400 mb-2">Invalid JSON — showing raw:</p>
        <pre className="font-mono text-xs whitespace-pre-wrap">{text}</pre>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-4 font-mono text-xs" style={{ background: "var(--pat-bg)" }}>
      <JsonNode value={parsed} name={undefined} depth={0} defaultOpen={true} />
    </div>
  );
}

function JsonNode({ value, name, depth, defaultOpen }: { value: unknown; name?: string; depth: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(depth < 2 || !!defaultOpen);
  const isArr = Array.isArray(value);
  const isObj = !isArr && value !== null && typeof value === "object";

  if (!isArr && !isObj) {
    return (
      <div style={{ paddingLeft: depth * 14 }}>
        {name !== undefined && <span style={{ color: "var(--pat-cream)" }}>{JSON.stringify(name)}: </span>}
        <ValueNode value={value} />
      </div>
    );
  }

  const entries = isArr ? (value as unknown[]).map((v, i) => [i, v] as const) : Object.entries(value as object);
  const open_b = isArr ? "[" : "{";
  const close_b = isArr ? "]" : "}";

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      <div className="cursor-pointer flex items-start gap-1 select-none" onClick={() => setOpen(!open)} style={{ color: "var(--pat-text)" }}>
        {open ? <ChevronDown className="h-3 w-3 mt-0.5 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />}
        {name !== undefined && <span style={{ color: "var(--pat-cream)" }}>{JSON.stringify(name)}: </span>}
        <span>{open_b}{!open && <span style={{ color: "var(--pat-muted)" }}> {entries.length} {isArr ? "items" : "keys"} </span>}{!open && close_b}</span>
      </div>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <JsonNode key={String(k)} value={v} name={isArr ? undefined : String(k)} depth={depth + 1} />
          ))}
          <div style={{ color: "var(--pat-text)" }}>{close_b}</div>
        </>
      )}
    </div>
  );
}

function ValueNode({ value }: { value: unknown }) {
  if (value === null) return <span style={{ color: "var(--pat-muted)" }}>null</span>;
  if (typeof value === "boolean") return <span style={{ color: "#a78bfa" }}>{String(value)}</span>;
  if (typeof value === "number") return <span style={{ color: "#60a5fa" }}>{value}</span>;
  if (typeof value === "string") return <span style={{ color: "#86efac" }}>{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}
