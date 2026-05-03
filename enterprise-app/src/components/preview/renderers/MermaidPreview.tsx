"use client";

import { useEffect, useRef, useState } from "react";
import { fetchText } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";
import { Loader2 } from "lucide-react";

export function MermaidPreview({ file }: { file: PreviewFile }) {
  const [text, setText] = useState<string | null>(file.text ?? null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (text !== null) return;
    fetchText(file).then(setText).catch((e) => setError(String(e)));
  }, [file, text]);

  useEffect(() => {
    if (!text) return;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            background: "transparent",
            primaryColor: "#C8A96E",
            primaryTextColor: "#EDE8E0",
            primaryBorderColor: "#C8A96E",
            lineColor: "#7A7060",
            secondaryColor: "#1c1a17",
            tertiaryColor: "#1c1a17",
          },
        });
        const id = "mermaid-" + Math.random().toString(36).slice(2, 9);
        const { svg: rendered } = await mermaid.render(id, text);
        setSvg(rendered);
      } catch (e) {
        setError(`Mermaid render failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, [text]);

  if (error) return <div className="p-6 text-sm text-red-400 whitespace-pre-wrap">{error}\n\n{text}</div>;
  if (text === null || !svg) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pat-cream)" }} />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-8 flex items-center justify-center" style={{ background: "var(--pat-surface)" }}>
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
