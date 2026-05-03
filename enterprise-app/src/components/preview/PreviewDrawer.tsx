"use client";

import { useEffect, useRef, useCallback } from "react";
import { X, Download, ExternalLink } from "lucide-react";
import { usePreview } from "@/store/preview";
import { pickRenderer } from "./dispatch";
import { fileUrl } from "./fileUrl";
import { HtmlPreview } from "./renderers/HtmlPreview";
import { PdfPreview } from "./renderers/PdfPreview";
import { ImagePreview } from "./renderers/ImagePreview";
import { VideoPreview, AudioPreview } from "./renderers/VideoAudioPreview";
import { MarkdownPreview } from "./renderers/MarkdownPreview";
import { CodePreview } from "./renderers/CodePreview";
import { JsonPreview } from "./renderers/JsonPreview";
import { SpreadsheetPreview } from "./renderers/SpreadsheetPreview";
import { MermaidPreview } from "./renderers/MermaidPreview";
import { IcsPreview } from "./renderers/IcsPreview";
import { DocxPreview } from "./renderers/DocxPreview";
import { FallbackPreview } from "./renderers/FallbackPreview";

function formatBytes(n?: number): string {
  if (n === undefined) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function PreviewDrawer() {
  const { open, file, width, closePreview, setWidth } = usePreview();
  const dragging = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(0);

  // Keyboard shortcuts: ⌘W or Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        closePreview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePreview]);

  // Drag-to-resize handle
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startXRef.current = e.clientX;
    startWRef.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startXRef.current - e.clientX;
      setWidth(startWRef.current + delta);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setWidth]);

  async function openExternal() {
    if (!file) return;
    // Workspace files: open via the absolute path
    if (file.source === "workspace" && file.workspace && file.path) {
      const abs = `${file.workspace}/${file.path}`;
      window.nexus?.openPath?.(abs);
      return;
    }
    // Generated/upload: download endpoint URL — let Electron handle it
    if (typeof window !== "undefined") {
      window.open(fileUrl(file), "_blank");
    }
  }

  if (!open || !file) return null;

  const kind = pickRenderer(file.filename, file.mimeType);

  let body: React.ReactNode;
  switch (kind) {
    case "html":        body = <HtmlPreview file={file} />; break;
    case "pdf":         body = <PdfPreview file={file} />; break;
    case "image":       body = <ImagePreview file={file} />; break;
    case "video":       body = <VideoPreview file={file} />; break;
    case "audio":       body = <AudioPreview file={file} />; break;
    case "markdown":    body = <MarkdownPreview file={file} />; break;
    case "code":        body = <CodePreview file={file} />; break;
    case "json":        body = <JsonPreview file={file} />; break;
    case "spreadsheet": body = <SpreadsheetPreview file={file} />; break;
    case "mermaid":     body = <MermaidPreview file={file} />; break;
    case "ics":         body = <IcsPreview file={file} />; break;
    case "docx":        body = <DocxPreview file={file} />; break;
    case "fallback":    body = <FallbackPreview file={file} onOpenExternal={openExternal} />; break;
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col border-l h-full"
      style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)", width: `${width}px` }}
    >
      {/* Drag handle on the LEFT edge */}
      <div
        onMouseDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--pat-cream)] transition-colors"
        style={{ marginLeft: -2 }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: "var(--pat-border)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: "var(--pat-text)" }}>
            {file.filename}
          </div>
          <div className="text-[10px]" style={{ color: "var(--pat-muted)" }}>
            {file.mimeType || kind} · {formatBytes(file.sizeBytes)}
          </div>
        </div>
        {(file.source === "generated" || file.source === "upload") && (
          <a
            href={fileUrl(file)}
            download={file.filename}
            title="Download"
            className="p-1.5 rounded hover:bg-white/8 transition-colors"
            style={{ color: "var(--pat-muted)" }}
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          onClick={openExternal}
          title="Open in default app"
          className="p-1.5 rounded hover:bg-white/8 transition-colors"
          style={{ color: "var(--pat-muted)" }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={closePreview}
          title="Close (Esc)"
          className="p-1.5 rounded hover:bg-white/8 transition-colors"
          style={{ color: "var(--pat-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {body}
      </div>
    </div>
  );
}
