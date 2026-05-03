"use client";

import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/atom-one-dark.css";
import { fetchText } from "../fileUrl";
import { highlightLanguage } from "../dispatch";
import type { PreviewFile } from "@/store/preview";
import { Loader2 } from "lucide-react";

export function CodePreview({ file }: { file: PreviewFile }) {
  const [text, setText] = useState<string | null>(file.text ?? null);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (text !== null) return;
    fetchText(file).then(setText).catch((e) => setError(String(e)));
  }, [file, text]);

  useEffect(() => {
    if (text && codeRef.current) {
      // Manually highlight on the rendered element
      hljs.highlightElement(codeRef.current);
    }
  }, [text]);

  if (error) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (text === null) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pat-cream)" }} />
      </div>
    );
  }

  const lang = highlightLanguage(file.filename);
  const lines = text.split("\n");

  return (
    <div className="h-full w-full overflow-auto" style={{ background: "#282c34" }}>
      <div className="flex">
        {/* Line numbers */}
        <div
          className="select-none text-right px-3 py-4 font-mono text-xs flex-shrink-0 sticky left-0"
          style={{ color: "rgba(255,255,255,0.25)", background: "#21252b", minWidth: "3.5rem" }}
        >
          {lines.map((_, i) => (
            <div key={i} style={{ lineHeight: "1.5rem" }}>{i + 1}</div>
          ))}
        </div>
        {/* Code */}
        <pre className="flex-1 m-0 py-4 px-4 text-xs overflow-x-auto" style={{ background: "transparent" }}>
          <code
            ref={codeRef}
            className={lang ? `language-${lang}` : undefined}
            style={{ background: "transparent", padding: 0, lineHeight: "1.5rem" }}
          >
            {text}
          </code>
        </pre>
      </div>
    </div>
  );
}
