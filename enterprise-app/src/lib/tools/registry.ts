import { z } from "zod";
import { saveGeneratedFile } from "./storage";
import type { ToolDefinition, ToolExecutionResult } from "./types";

// File-creation libraries
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
// pptxgenjs is CommonJS — import default
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

// ---------------------------------------------------------------------------
// File creation tools
// ---------------------------------------------------------------------------

const createPdf: ToolDefinition = {
  id: "create_pdf",
  displayName: "Create PDF",
  category: "files",
  description:
    "Generate a PDF document with a title and body content. Use for reports, summaries, memos, or any text the user should download as a PDF.",
  uiHint: "Generate PDF documents from text content.",
  parameters: z.object({
    filename: z.string().describe("File name including .pdf extension"),
    title: z.string().describe("Document title shown at top of page 1"),
    content: z.string().describe("Body text. Newlines create paragraph breaks. Markdown-light: lines starting with # become headings."),
  }),
  async execute({ filename, title, content }, ctx) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([612, 792]); // US Letter
    const margin = 56;
    let y = 792 - margin;

    page.drawText(title, { x: margin, y, size: 22, font: bold, color: rgb(0.1, 0.1, 0.12) });
    y -= 36;

    const lineH = 16;
    const maxWidth = 612 - margin * 2;
    const lines = content.split("\n");
    for (const raw of lines) {
      const isHeading = raw.startsWith("# ");
      const text = isHeading ? raw.replace(/^#+\s*/, "") : raw;
      const useFont = isHeading ? bold : font;
      const size = isHeading ? 14 : 11;

      // crude word wrap
      const words = text.split(/\s+/);
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        const width = useFont.widthOfTextAtSize(test, size);
        if (width > maxWidth && line) {
          if (y < margin) { page = pdf.addPage([612, 792]); y = 792 - margin; }
          page.drawText(line, { x: margin, y, size, font: useFont, color: rgb(0.15, 0.15, 0.18) });
          y -= lineH;
          line = w;
        } else {
          line = test;
        }
      }
      if (line) {
        if (y < margin) { page = pdf.addPage([612, 792]); y = 792 - margin; }
        page.drawText(line, { x: margin, y, size, font: useFont, color: rgb(0.15, 0.15, 0.18) });
        y -= isHeading ? lineH + 4 : lineH;
      } else {
        y -= lineH * 0.5; // blank line
      }
    }

    const bytes = await pdf.save();
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "application/pdf",
      toolName: "create_pdf",
      content: Buffer.from(bytes),
    });
    return { ok: true, file, message: `Created ${file.filename} (${file.sizeBytes} bytes)` };
  },
};

const createDocx: ToolDefinition = {
  id: "create_docx",
  displayName: "Create Word Doc",
  category: "files",
  description: "Generate a Microsoft Word (.docx) document. Use for letters, memos, contracts, formatted reports.",
  uiHint: "Generate .docx Word documents.",
  parameters: z.object({
    filename: z.string().describe("File name including .docx extension"),
    title: z.string().describe("Document title"),
    content: z.string().describe("Body content. Lines starting with # are headings; blank lines separate paragraphs."),
  }),
  async execute({ filename, title, content }, ctx) {
    const children: Paragraph[] = [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    ];
    for (const raw of content.split("\n")) {
      if (!raw.trim()) {
        children.push(new Paragraph({ text: "" }));
        continue;
      }
      if (raw.startsWith("# ")) {
        children.push(new Paragraph({ text: raw.replace(/^#+\s*/, ""), heading: HeadingLevel.HEADING_1 }));
      } else if (raw.startsWith("## ")) {
        children.push(new Paragraph({ text: raw.replace(/^#+\s*/, ""), heading: HeadingLevel.HEADING_2 }));
      } else {
        children.push(new Paragraph({ children: [new TextRun(raw)] }));
      }
    }
    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      toolName: "create_docx",
      content: buffer,
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

const createPptx: ToolDefinition = {
  id: "create_pptx",
  displayName: "Create PowerPoint",
  category: "files",
  description: "Generate a PowerPoint (.pptx) presentation. Provide an array of slides with title and bullet points.",
  uiHint: "Generate .pptx PowerPoint decks.",
  parameters: z.object({
    filename: z.string().describe("File name including .pptx extension"),
    slides: z.array(z.object({
      title: z.string(),
      bullets: z.array(z.string()).describe("Bullet points for the slide body"),
    })).describe("Array of slides"),
  }),
  async execute({ filename, slides }, ctx) {
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE";
    for (const s of slides as Array<{ title: string; bullets: string[] }>) {
      const slide = pres.addSlide();
      slide.background = { color: "0F0F11" };
      slide.addText(s.title, {
        x: 0.5, y: 0.4, w: 12, h: 0.9,
        fontSize: 32, bold: true, color: "FFFFFF", fontFace: "Helvetica",
      });
      slide.addText(
        (s.bullets ?? []).map((b) => ({ text: b, options: { bullet: true } })),
        { x: 0.7, y: 1.6, w: 12, h: 5.5, fontSize: 18, color: "E4E4E7", fontFace: "Helvetica", paraSpaceAfter: 8 }
      );
    }
    const buffer = (await pres.write({ outputType: "nodebuffer" })) as Buffer;

    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      toolName: "create_pptx",
      content: buffer,
    });
    return { ok: true, file, message: `Created ${file.filename} with ${slides.length} slides` };
  },
};

const createXlsx: ToolDefinition = {
  id: "create_xlsx",
  displayName: "Create Excel Workbook",
  category: "files",
  description: "Generate an Excel (.xlsx) workbook. Provide one or more sheets, each with a name and a 2D array of rows.",
  uiHint: "Generate .xlsx Excel spreadsheets.",
  parameters: z.object({
    filename: z.string().describe("File name including .xlsx extension"),
    sheets: z.array(z.object({
      name: z.string().describe("Sheet name (max 31 chars)"),
      rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("2D array of cell values; first row is typically headers"),
    })),
  }),
  async execute({ filename, sheets }, ctx) {
    const wb = XLSX.utils.book_new();
    for (const s of sheets as Array<{ name: string; rows: (string | number | boolean | null)[][] }>) {
      const ws = XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    }
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      toolName: "create_xlsx",
      content: buffer,
    });
    return { ok: true, file, message: `Created ${file.filename} with ${sheets.length} sheet(s)` };
  },
};

const createCsv: ToolDefinition = {
  id: "create_csv",
  displayName: "Create CSV",
  category: "files",
  description: "Generate a CSV file. Provide a header row and an array of data rows.",
  uiHint: "Generate .csv data files.",
  parameters: z.object({
    filename: z.string().describe("File name including .csv extension"),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  }),
  async execute({ filename, headers, rows }, ctx) {
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(escape).join(","), ...rows.map((r: unknown[]) => r.map(escape).join(","))].join("\n");

    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "text/csv",
      toolName: "create_csv",
      content: csv,
    });
    return { ok: true, file, message: `Created ${file.filename} (${rows.length} rows)` };
  },
};

const createMarkdown: ToolDefinition = {
  id: "create_markdown",
  displayName: "Create Markdown",
  category: "files",
  description: "Save markdown content as a .md file. Use for README files, docs, notes.",
  uiHint: "Generate .md markdown files.",
  parameters: z.object({
    filename: z.string(),
    content: z.string(),
  }),
  async execute({ filename, content }, ctx) {
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "text/markdown",
      toolName: "create_markdown",
      content,
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

const createHtml: ToolDefinition = {
  id: "create_html",
  displayName: "Create HTML",
  category: "files",
  description: "Save HTML content as a .html file. Provide complete HTML or just the body — the tool will wrap it in a minimal document if no <html> tag is present.",
  uiHint: "Generate standalone .html pages.",
  parameters: z.object({
    filename: z.string(),
    content: z.string(),
    title: z.string().optional(),
  }),
  async execute({ filename, content, title }, ctx) {
    const html = /<html/i.test(content as string)
      ? content
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title ?? "Document"}</title></head><body>${content}</body></html>`;
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "text/html",
      toolName: "create_html",
      content: html,
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

const createJson: ToolDefinition = {
  id: "create_json",
  displayName: "Create JSON",
  category: "files",
  description: "Save a JSON object/array to a .json file. Pretty-printed.",
  uiHint: "Generate .json data files.",
  parameters: z.object({
    filename: z.string(),
    data: z.unknown().describe("Any JSON-serializable value"),
  }),
  async execute({ filename, data }, ctx) {
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "application/json",
      toolName: "create_json",
      content: JSON.stringify(data, null, 2),
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

const createYaml: ToolDefinition = {
  id: "create_yaml",
  displayName: "Create YAML",
  category: "files",
  description: "Save YAML content to a .yaml file. Provide raw YAML text.",
  uiHint: "Generate .yaml config files.",
  parameters: z.object({
    filename: z.string(),
    content: z.string().describe("Raw YAML content"),
  }),
  async execute({ filename, content }, ctx) {
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "text/yaml",
      toolName: "create_yaml",
      content,
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

const createText: ToolDefinition = {
  id: "create_text",
  displayName: "Create Text File",
  category: "files",
  description: "Save plain text to a .txt file.",
  uiHint: "Generate plain .txt files.",
  parameters: z.object({
    filename: z.string(),
    content: z.string(),
  }),
  async execute({ filename, content }, ctx) {
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "text/plain",
      toolName: "create_text",
      content,
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

const createSvg: ToolDefinition = {
  id: "create_svg",
  displayName: "Create SVG",
  category: "files",
  description: "Save an SVG vector graphic to a .svg file.",
  uiHint: "Generate .svg vector graphics.",
  parameters: z.object({
    filename: z.string(),
    content: z.string().describe("Raw SVG markup including <svg> tag"),
  }),
  async execute({ filename, content }, ctx) {
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "image/svg+xml",
      toolName: "create_svg",
      content,
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

const createCalendarInvite: ToolDefinition = {
  id: "create_calendar_invite",
  displayName: "Create Calendar Invite",
  category: "files",
  description: "Generate an .ics calendar invite. Times must be ISO 8601 (e.g. 2026-05-15T14:00:00).",
  uiHint: "Generate .ics calendar invites.",
  parameters: z.object({
    filename: z.string().describe("File name including .ics extension"),
    title: z.string(),
    description: z.string().optional(),
    location: z.string().optional(),
    start: z.string().describe("ISO 8601 start datetime"),
    end: z.string().describe("ISO 8601 end datetime"),
    organizerEmail: z.string().optional(),
    attendeeEmails: z.array(z.string()).optional(),
  }),
  async execute(args, ctx) {
    const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nexus//EN", "BEGIN:VEVENT",
      `UID:${Date.now()}@nexus.local`,
      `DTSTAMP:${fmt(new Date().toISOString())}`,
      `DTSTART:${fmt(args.start)}`,
      `DTEND:${fmt(args.end)}`,
      `SUMMARY:${args.title}`,
    ];
    if (args.description) lines.push(`DESCRIPTION:${args.description.replace(/\n/g, "\\n")}`);
    if (args.location) lines.push(`LOCATION:${args.location}`);
    if (args.organizerEmail) lines.push(`ORGANIZER:mailto:${args.organizerEmail}`);
    for (const a of args.attendeeEmails ?? []) lines.push(`ATTENDEE:mailto:${a}`);
    lines.push("END:VEVENT", "END:VCALENDAR");

    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename: args.filename,
      mimeType: "text/calendar",
      toolName: "create_calendar_invite",
      content: lines.join("\r\n"),
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

// ---------------------------------------------------------------------------
// Web tools
// ---------------------------------------------------------------------------

const fetchUrl: ToolDefinition = {
  id: "fetch_url",
  displayName: "Fetch URL",
  category: "web",
  description: "Fetch the raw contents of a URL. Returns the response body as text.",
  uiHint: "Allow the model to fetch any web page or API.",
  parameters: z.object({
    url: z.string().url(),
    method: z.enum(["GET", "POST"]).default("GET").optional(),
  }),
  async execute({ url, method }) {
    try {
      const res = await fetch(url, { method: method ?? "GET", signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      return { ok: true, data: { status: res.status, contentType: res.headers.get("content-type"), body: text.slice(0, 50_000) }, message: `Fetched ${url} (${res.status}, ${text.length} bytes)` };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
};

const searchWeb: ToolDefinition = {
  id: "search_web",
  displayName: "Search Web",
  category: "web",
  description: "Search the web via DuckDuckGo. Returns a list of titles, URLs, and snippets.",
  uiHint: "Web search via DuckDuckGo (no API key required).",
  parameters: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().int().min(1).max(20).default(10).optional(),
  }),
  async execute({ query, limit }) {
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "Mozilla/5.0 NexusBot" },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      const results: Array<{ title: string; url: string; snippet: string }> = [];
      const re = /<a class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]+?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]+?)<\/a>/g;
      let m;
      while ((m = re.exec(html)) && results.length < (limit ?? 10)) {
        const cleanUrl = decodeURIComponent(m[1].replace(/^.*uddg=/, "").split("&")[0]);
        results.push({
          title: m[2].replace(/<[^>]+>/g, "").trim(),
          url: cleanUrl.startsWith("http") ? cleanUrl : m[1],
          snippet: m[3].replace(/<[^>]+>/g, "").trim(),
        });
      }
      return { ok: true, data: { results }, message: `Found ${results.length} results for "${query}"` };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
};

const extractTextFromUrl: ToolDefinition = {
  id: "extract_text_from_url",
  displayName: "Extract Text from URL",
  category: "web",
  description: "Fetch a URL and return clean readable text (HTML stripped).",
  uiHint: "Scrape clean text from any webpage.",
  parameters: z.object({
    url: z.string().url(),
  }),
  async execute({ url }) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 NexusBot" }, signal: AbortSignal.timeout(15000) });
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
      return { ok: true, data: { text: text.slice(0, 30_000) }, message: `Extracted ${text.length} characters from ${url}` };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
};

const generateQrCode: ToolDefinition = {
  id: "generate_qr_code",
  displayName: "Generate QR Code",
  category: "web",
  description: "Generate a QR code as a PNG file from any text or URL.",
  uiHint: "Create QR code PNG images.",
  parameters: z.object({
    filename: z.string().describe("Output filename including .png extension"),
    data: z.string().describe("Text or URL to encode"),
  }),
  async execute({ filename, data }, ctx) {
    const buffer = await QRCode.toBuffer(data, { width: 512, margin: 2 });
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "image/png",
      toolName: "generate_qr_code",
      content: buffer,
    });
    return { ok: true, file, message: `Created QR code ${file.filename}` };
  },
};

// ---------------------------------------------------------------------------
// Utility tools
// ---------------------------------------------------------------------------

const calculate: ToolDefinition = {
  id: "calculate",
  displayName: "Calculator",
  category: "utility",
  description: "Evaluate a mathematical expression. Supports +, -, *, /, %, **, parentheses, and Math functions like sqrt, sin, log.",
  uiHint: "Safe math expression evaluator.",
  parameters: z.object({
    expression: z.string().describe("Math expression (e.g. '(2+3) * sqrt(16)')"),
  }),
  async execute({ expression }) {
    // Allow only safe characters and Math.* functions
    const safe = (expression as string).replace(/(sqrt|sin|cos|tan|log|exp|abs|round|floor|ceil|pow|min|max|PI|E)\b/g, (m) => `Math.${m}`);
    if (/[^0-9+\-*/().,%\s\w]/.test(expression as string)) {
      return { ok: false, error: "Expression contains disallowed characters" };
    }
    try {
      const result = Function(`"use strict"; return (${safe})`)();
      if (typeof result !== "number" || !isFinite(result)) {
        return { ok: false, error: "Expression did not produce a finite number" };
      }
      return { ok: true, data: { result }, message: `${expression} = ${result}` };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
};

const getCurrentTime: ToolDefinition = {
  id: "get_current_time",
  displayName: "Current Time",
  category: "utility",
  description: "Get the current date and time, optionally in a specific timezone.",
  uiHint: "Date/time lookup in any timezone.",
  parameters: z.object({
    timezone: z.string().optional().describe("IANA timezone like 'America/New_York'. Defaults to system timezone."),
  }),
  async execute({ timezone }) {
    const now = new Date();
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone ?? undefined,
        dateStyle: "full",
        timeStyle: "long",
      });
      return { ok: true, data: { iso: now.toISOString(), formatted: fmt.format(now), timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone }, message: fmt.format(now) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
};

const formatTable: ToolDefinition = {
  id: "format_table",
  displayName: "Format Table",
  category: "utility",
  description: "Convert tabular data between markdown, CSV, and JSON formats.",
  uiHint: "Convert tables between markdown / CSV / JSON.",
  parameters: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
    format: z.enum(["markdown", "csv", "json"]),
  }),
  async execute({ headers, rows, format }) {
    let output = "";
    if (format === "json") {
      output = JSON.stringify(rows.map((r: unknown[]) => Object.fromEntries(headers.map((h: string, i: number) => [h, r[i]]))), null, 2);
    } else if (format === "csv") {
      const escape = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      output = [headers.map(escape).join(","), ...rows.map((r: unknown[]) => r.map(escape).join(","))].join("\n");
    } else {
      output = `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows.map((r: unknown[]) => `| ${r.map((v) => String(v ?? "")).join(" | ")} |`).join("\n")}`;
    }
    return { ok: true, data: { output }, message: `Formatted ${rows.length}-row table as ${format}` };
  },
};

const generateMermaidDiagram: ToolDefinition = {
  id: "generate_mermaid_diagram",
  displayName: "Generate Mermaid Diagram",
  category: "utility",
  description: "Save a Mermaid diagram (flowchart, sequence, gantt, etc.) as a .mmd file. The user can render it in any Mermaid viewer.",
  uiHint: "Generate Mermaid (.mmd) diagrams.",
  parameters: z.object({
    filename: z.string().describe("File name including .mmd extension"),
    diagram: z.string().describe("Mermaid syntax (e.g. 'graph TD\\n  A-->B')"),
  }),
  async execute({ filename, diagram }, ctx) {
    const file = await saveGeneratedFile({
      conversationId: ctx.conversationId,
      filename,
      mimeType: "text/x-mermaid",
      toolName: "generate_mermaid_diagram",
      content: diagram,
    });
    return { ok: true, file, message: `Created ${file.filename}` };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TOOL_CATALOG: ToolDefinition[] = [
  // Files
  createPdf, createDocx, createPptx, createXlsx, createCsv,
  createMarkdown, createHtml, createJson, createYaml, createText,
  createSvg, createCalendarInvite,
  // Web
  fetchUrl, searchWeb, extractTextFromUrl, generateQrCode,
  // Utility
  calculate, getCurrentTime, formatTable, generateMermaidDiagram,
];

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOL_CATALOG.find((t) => t.id === id);
}

// Models with reliable tool-calling support. Used by the UI to warn the user.
export const TOOL_CAPABLE_MODELS = new Set([
  "mistral:7b", "llama3.2:3b", "llama3.2-vision:11b", "qwen2.5:14b", "qwen2.5-coder:7b",
  "qwen2.5-coder:14b", "phi4:14b", "deepseek-coder-v2:16b", "gemma3:12b",
]);

export type { ToolExecutionResult };
