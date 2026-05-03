"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchText } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";
import { Loader2 } from "lucide-react";

export function MarkdownPreview({ file }: { file: PreviewFile }) {
  const [text, setText] = useState<string | null>(file.text ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (text !== null) return;
    fetchText(file).then(setText).catch((e) => setError(String(e)));
  }, [file, text]);

  if (error) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (text === null) return <Loading />;

  return (
    <div
      className="h-full w-full overflow-auto px-8 py-6 prose-pat"
      style={{ background: "var(--pat-surface)" }}
    >
      <div className="max-w-3xl mx-auto" style={{ color: "var(--pat-text)" }}>
        <style>{`
          .prose-pat h1, .prose-pat h2, .prose-pat h3, .prose-pat h4 {
            font-family: var(--font-cormorant), Georgia, serif;
            color: var(--pat-text);
            margin-top: 1.4em;
            margin-bottom: 0.5em;
            font-weight: 600;
          }
          .prose-pat h1 { font-size: 2rem; }
          .prose-pat h2 { font-size: 1.6rem; }
          .prose-pat h3 { font-size: 1.3rem; }
          .prose-pat p { line-height: 1.7; margin: 0.8em 0; color: var(--pat-text); }
          .prose-pat a { color: var(--pat-cream); text-decoration: underline; }
          .prose-pat ul, .prose-pat ol { padding-left: 1.5em; margin: 0.8em 0; }
          .prose-pat li { margin: 0.3em 0; }
          .prose-pat code {
            background: var(--pat-cream-10);
            color: var(--pat-cream);
            padding: 0.15em 0.4em;
            border-radius: 4px;
            font-size: 0.9em;
          }
          .prose-pat pre {
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--pat-border);
            padding: 1em;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
          }
          .prose-pat pre code { background: none; padding: 0; color: var(--pat-text); }
          .prose-pat blockquote {
            border-left: 3px solid var(--pat-cream);
            padding-left: 1em;
            margin: 1em 0;
            color: var(--pat-muted);
            font-style: italic;
          }
          .prose-pat table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
          }
          .prose-pat th, .prose-pat td {
            border: 1px solid var(--pat-border);
            padding: 0.5em 0.75em;
            text-align: left;
          }
          .prose-pat th { background: var(--pat-cream-10); }
          .prose-pat hr { border: none; border-top: 1px solid var(--pat-border); margin: 2em 0; }
        `}</style>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pat-cream)" }} />
    </div>
  );
}
