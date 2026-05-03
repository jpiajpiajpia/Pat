"use client";

import { useEffect, useState } from "react";
import { fileUrl } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";
import { Loader2 } from "lucide-react";

/**
 * DOCX → HTML conversion runs server-side (mammoth is heavy and Node-only).
 * The /api/preview/docx endpoint accepts the file URL and returns HTML.
 */
export function DocxPreview({ file }: { file: PreviewFile }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/preview/docx?url=${encodeURIComponent(fileUrl(file))}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setHtml(data.html ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [file]);

  if (error) return <div className="p-6 text-sm text-red-400">DOCX preview failed: {error}</div>;
  if (html === null) return (
    <div className="h-full w-full flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pat-cream)" }} />
    </div>
  );

  return (
    <div className="h-full w-full overflow-auto px-8 py-6" style={{ background: "var(--pat-surface)" }}>
      <div
        className="docx-content max-w-3xl mx-auto"
        style={{ color: "var(--pat-text)" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        .docx-content { font-family: var(--font-inter), system-ui, sans-serif; line-height: 1.7; }
        .docx-content h1, .docx-content h2, .docx-content h3 {
          font-family: var(--font-cormorant), Georgia, serif;
          margin-top: 1.4em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        .docx-content h1 { font-size: 2rem; }
        .docx-content h2 { font-size: 1.6rem; }
        .docx-content p { margin: 0.7em 0; }
        .docx-content ul, .docx-content ol { padding-left: 1.5em; margin: 0.7em 0; }
        .docx-content li { margin: 0.3em 0; }
        .docx-content a { color: var(--pat-cream); text-decoration: underline; }
        .docx-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        .docx-content th, .docx-content td { border: 1px solid var(--pat-border); padding: 0.5em 0.75em; }
        .docx-content th { background: var(--pat-cream-10); }
        .docx-content img { max-width: 100%; border-radius: 4px; }
      `}</style>
    </div>
  );
}
