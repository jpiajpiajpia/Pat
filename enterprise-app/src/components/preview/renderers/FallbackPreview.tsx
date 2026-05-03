"use client";

import { File, ExternalLink, Download } from "lucide-react";
import type { PreviewFile } from "@/store/preview";
import { fileUrl } from "../fileUrl";

export function FallbackPreview({ file, onOpenExternal }: { file: PreviewFile; onOpenExternal: () => void }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-5 p-8 text-center" style={{ background: "var(--pat-surface)" }}>
      <div
        className="h-20 w-20 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--pat-cream-20)" }}
      >
        <File className="h-10 w-10" style={{ color: "var(--pat-cream)" }} />
      </div>
      <div>
        <h2 className="font-serif text-2xl mb-1" style={{ color: "var(--pat-text)" }}>{file.filename}</h2>
        <p className="text-xs" style={{ color: "var(--pat-muted)" }}>{file.mimeType || "unknown type"}</p>
      </div>
      <p className="text-sm max-w-sm" style={{ color: "var(--pat-muted)" }}>
        Preview isn&apos;t available for this file type yet — open it in your default app to view it.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onOpenExternal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: "var(--pat-cream)", color: "var(--pat-bg)" }}
        >
          <ExternalLink className="h-4 w-4" />
          Open externally
        </button>
        <a
          href={fileUrl(file)}
          download={file.filename}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
          style={{ borderColor: "var(--pat-border)", color: "var(--pat-text)", background: "transparent" }}
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    </div>
  );
}
