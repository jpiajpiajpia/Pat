"use client";

import { fileUrl } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";

export function VideoPreview({ file }: { file: PreviewFile }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-4" style={{ background: "var(--pat-bg)" }}>
      <video
        src={fileUrl(file)}
        controls
        className="max-w-full max-h-full rounded shadow-lg"
      />
    </div>
  );
}

export function AudioPreview({ file }: { file: PreviewFile }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-8" style={{ background: "var(--pat-surface)" }}>
      <div className="w-full max-w-md text-center">
        <p className="text-sm mb-4" style={{ color: "var(--pat-text)" }}>{file.filename}</p>
        <audio src={fileUrl(file)} controls className="w-full" />
      </div>
    </div>
  );
}
