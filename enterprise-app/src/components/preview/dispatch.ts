/**
 * Maps a file (by mime + extension) to the renderer kind that should display it.
 * Renderer components consume this kind to decide their behavior.
 */

export type RendererKind =
  | "html"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "markdown"
  | "code"
  | "json"
  | "spreadsheet"
  | "mermaid"
  | "ics"
  | "docx"
  | "fallback";

export function pickRenderer(filename: string, mimeType: string): RendererKind {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const mt = (mimeType ?? "").toLowerCase();

  // Images
  if (mt.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "tiff", "tif", "heic", "heif"].includes(ext)) {
    return "image";
  }
  // Video
  if (mt.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) {
    return "video";
  }
  // Audio
  if (mt.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) {
    return "audio";
  }
  // PDF
  if (mt === "application/pdf" || ext === "pdf") return "pdf";
  // HTML — render in sandboxed iframe
  if (mt === "text/html" || ["html", "htm"].includes(ext)) return "html";
  // Markdown
  if (["md", "markdown", "mdx"].includes(ext) || mt === "text/markdown") return "markdown";
  // Mermaid diagrams
  if (ext === "mmd" || mt.includes("mermaid")) return "mermaid";
  // Calendar
  if (ext === "ics" || mt === "text/calendar") return "ics";
  // Spreadsheets
  if (["xlsx", "xls", "csv", "ods", "tsv"].includes(ext) || mt.includes("spreadsheetml") || mt === "text/csv") {
    return "spreadsheet";
  }
  // DOCX
  if (ext === "docx" || mt.includes("wordprocessingml")) return "docx";
  // JSON
  if (ext === "json" || mt === "application/json") return "json";
  // Source code & plain text
  const codeExts = [
    "js", "jsx", "ts", "tsx", "mjs", "cjs",
    "py", "go", "rs", "java", "kt", "scala", "rb", "php", "swift",
    "c", "cc", "cpp", "h", "hpp", "cs",
    "css", "scss", "less", "sass",
    "yaml", "yml", "toml", "ini", "cfg", "conf", "env",
    "sh", "bash", "zsh", "fish", "ps1",
    "sql", "graphql", "gql",
    "vue", "svelte",
    "lua", "r", "pl", "pm",
    "dockerfile", "makefile", "gitignore",
    "txt", "log", "out", "diff", "patch",
    "xml", "plist",
  ];
  if (codeExts.includes(ext) || mt.startsWith("text/")) return "code";

  // Unknown — fallback drawer with metadata + open-externally
  return "fallback";
}

/**
 * Map an extension or kind to a Highlight.js language identifier.
 * Used by CodePreview to pick the right syntax mode.
 */
export function highlightLanguage(filename: string): string | undefined {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    kt: "kotlin", scala: "scala", swift: "swift", php: "php",
    c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp", cs: "csharp",
    css: "css", scss: "scss", less: "less", sass: "sass",
    yaml: "yaml", yml: "yaml", toml: "ini", ini: "ini",
    sh: "bash", bash: "bash", zsh: "bash", fish: "bash", ps1: "powershell",
    sql: "sql", graphql: "graphql", gql: "graphql",
    json: "json", xml: "xml", html: "html", md: "markdown",
    vue: "xml", svelte: "xml",
    lua: "lua", r: "r", pl: "perl", pm: "perl",
    dockerfile: "dockerfile", makefile: "makefile",
    diff: "diff", patch: "diff",
    plist: "xml",
  };
  return map[ext];
}
