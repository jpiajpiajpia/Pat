import { NextRequest, NextResponse } from "next/server";
import { TOOL_CATALOG, getToolById } from "@/lib/tools/registry";

/**
 * Tool sanity test endpoint.
 *
 * GET  /api/tools/test               — list all tools and their default test args
 * POST /api/tools/test  body: {id}   — run a tool with sample args; returns ok/error + actual output
 */

interface SampleArgs {
  [toolId: string]: Record<string, unknown>;
}

const SAMPLES: SampleArgs = {
  // Files
  create_pdf: { filename: "test.pdf", title: "Test Document", content: "# Heading\nThis is a test paragraph.\nSecond paragraph." },
  create_docx: { filename: "test.docx", title: "Test", content: "# Heading\n\nFirst paragraph.\n\nSecond paragraph." },
  create_pptx: { filename: "test.pptx", slides: [{ title: "Slide 1", bullets: ["Point A", "Point B"] }, { title: "Slide 2", bullets: ["Point C"] }] },
  create_xlsx: { filename: "test.xlsx", sheets: [{ name: "Sheet1", rows: [["Name", "Age"], ["Alice", 30], ["Bob", 25]] }] },
  create_csv: { filename: "test.csv", headers: ["a", "b"], rows: [[1, 2], [3, 4]] },
  create_markdown: { filename: "test.md", content: "# Hello\n\nWorld" },
  create_html: { filename: "test.html", content: "<h1>Hello</h1>", title: "Test" },
  create_json: { filename: "test.json", data: { test: true, count: 3 } },
  create_yaml: { filename: "test.yaml", content: "name: test\nversion: 1" },
  create_text: { filename: "test.txt", content: "Hello world." },
  create_svg: { filename: "test.svg", content: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="gold"/></svg>' },
  create_calendar_invite: {
    filename: "test.ics", title: "Test Event",
    start: "2026-06-01T14:00:00", end: "2026-06-01T15:00:00",
    description: "A test event", location: "Online",
  },
  // Web
  fetch_url: { url: "https://example.com" },
  search_web: { query: "claude code", limit: 3 },
  extract_text_from_url: { url: "https://example.com" },
  generate_qr_code: { filename: "test_qr.png", data: "https://example.com" },
  // Utility
  calculate: { expression: "(2+3) * 4" },
  get_current_time: { timezone: "America/New_York" },
  format_table: { headers: ["a", "b"], rows: [[1, 2], [3, 4]], format: "markdown" },
  generate_mermaid_diagram: { filename: "test.mmd", diagram: "graph TD\n  A-->B" },
};

export async function GET() {
  return NextResponse.json({
    tools: TOOL_CATALOG.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      category: t.category,
      sampleArgs: SAMPLES[t.id] ?? {},
    })),
  });
}

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  const tool = getToolById(id);
  if (!tool) return NextResponse.json({ ok: false, error: `Unknown tool: ${id}` }, { status: 404 });

  const sample = SAMPLES[id];
  if (!sample) return NextResponse.json({ ok: false, error: `No sample args for ${id}` });

  const start = Date.now();
  try {
    // Validate via the tool's zod schema
    const parsed = tool.parameters.parse(sample);
    const result = await tool.execute(parsed as Record<string, unknown>, {
      conversationId: "tool-test",
      userId: null,
    });
    const elapsed = Date.now() - start;
    const r = result as { ok?: boolean; error?: string; file?: { filename: string; sizeBytes: number; downloadUrl: string } };
    return NextResponse.json({
      ok: r.ok !== false,
      elapsed,
      file: r.file,
      error: r.ok === false ? r.error : undefined,
      result: r.file ? undefined : result,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      elapsed: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5).join("\n") : undefined,
    });
  }
}
