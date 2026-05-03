"use client";

import { fileUrl } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";

export function PdfPreview({ file }: { file: PreviewFile }) {
  // Chromium has a built-in PDF viewer — iframe + content-type does the work
  return (
    <iframe
      src={fileUrl(file)}
      className="h-full w-full border-0 bg-white"
      title={file.filename}
    />
  );
}
