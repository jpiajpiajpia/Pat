import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

/**
 * Convert a DOCX file to HTML via mammoth (server-side; the lib is heavy and Node-only).
 * Accepts ?url=... pointing at our own /api/files/[id], /api/uploads/raw?id=..., or /api/workspace/raw?...
 * but for safety we resolve it server-side rather than re-fetching ourselves.
 *
 * Simpler shape: accept the source params directly.
 *   /api/preview/docx?source=generated&id=abc
 *   /api/preview/docx?source=upload&id=abc
 *   /api/preview/docx?source=workspace&workspace=/path&path=foo.docx
 *
 * For backward compatibility with the renderer using ?url=..., we also parse it.
 */
async function resolveBuffer(req: NextRequest): Promise<Buffer | null> {
  const url = new URL(req.url);
  const sourceParam = url.searchParams.get("source");
  const fwdUrl = url.searchParams.get("url");

  let source = sourceParam;
  let id = url.searchParams.get("id");
  let ws = url.searchParams.get("workspace");
  let p = url.searchParams.get("path");

  // If only ?url=... is given, parse it
  if (!source && fwdUrl) {
    const u = new URL(fwdUrl, "http://localhost");
    if (u.pathname.startsWith("/api/files/")) {
      source = "generated";
      id = u.pathname.split("/").pop() ?? null;
    } else if (u.pathname.startsWith("/api/uploads/raw")) {
      source = "upload";
      id = u.searchParams.get("id");
    } else if (u.pathname.startsWith("/api/workspace/raw")) {
      source = "workspace";
      ws = u.searchParams.get("workspace");
      p = u.searchParams.get("path");
    }
  }

  if (source === "generated" && id) {
    const f = await prisma.generatedFile.findUnique({ where: { id } });
    if (!f) return null;
    return fs.readFile(f.path);
  }
  if (source === "upload" && id) {
    const u = await prisma.upload.findUnique({ where: { id } });
    if (!u) return null;
    return fs.readFile(u.path);
  }
  if (source === "workspace" && ws && p) {
    const wsRoot = path.resolve(ws);
    const abs = path.resolve(wsRoot, p);
    if (!abs.startsWith(wsRoot)) return null;
    return fs.readFile(abs);
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const buf = await resolveBuffer(req);
    if (!buf) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ buffer: buf });
    return NextResponse.json({
      html: result.value,
      messages: result.messages.map((m) => m.message).slice(0, 5),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
