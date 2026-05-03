"use client";

import { fileUrl } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";

export function ImagePreview({ file }: { file: PreviewFile }) {
  return (
    <div className="h-full w-full overflow-auto flex items-center justify-center p-6" style={{ background: "var(--pat-surface)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fileUrl(file)}
        alt={file.filename}
        className="max-w-full max-h-full object-contain rounded shadow-lg"
      />
    </div>
  );
}
