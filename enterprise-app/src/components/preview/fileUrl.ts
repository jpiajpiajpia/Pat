import type { PreviewFile } from "@/store/preview";

/**
 * Resolve a PreviewFile to a URL that the renderer can fetch (or set as iframe/img src).
 * - generated/upload: served by /api/files/[id] or /api/uploads (binary)
 * - workspace: served by /api/workspace/raw (new, binary-safe)
 */
export function fileUrl(file: PreviewFile): string {
  switch (file.source) {
    case "generated":
      return `/api/files/${file.id}`;
    case "upload":
      return `/api/uploads/raw?id=${encodeURIComponent(file.id ?? "")}`;
    case "workspace":
      return `/api/workspace/raw?workspace=${encodeURIComponent(file.workspace ?? "")}&path=${encodeURIComponent(file.path ?? "")}`;
  }
}

/** Async helper to fetch the file's text content for renderers that need raw text */
export async function fetchText(file: PreviewFile): Promise<string> {
  if (file.text) return file.text;
  const res = await fetch(fileUrl(file));
  if (!res.ok) throw new Error(`Failed to load ${file.filename}: ${res.status}`);
  return res.text();
}

/** Async helper to fetch as ArrayBuffer for binary formats */
export async function fetchBuffer(file: PreviewFile): Promise<ArrayBuffer> {
  const res = await fetch(fileUrl(file));
  if (!res.ok) throw new Error(`Failed to load ${file.filename}: ${res.status}`);
  return res.arrayBuffer();
}
