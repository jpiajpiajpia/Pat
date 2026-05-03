"use client";

import { fileUrl } from "../fileUrl";
import type { PreviewFile } from "@/store/preview";

export function HtmlPreview({ file }: { file: PreviewFile }) {
  // sandbox="allow-scripts allow-same-origin" lets the page execute its own JS but isolates it from
  // the parent. We omit allow-top-navigation, allow-forms, allow-popups for safety.
  return (
    <iframe
      src={fileUrl(file)}
      sandbox="allow-scripts allow-same-origin"
      className="h-full w-full border-0 bg-white"
      title={file.filename}
    />
  );
}
