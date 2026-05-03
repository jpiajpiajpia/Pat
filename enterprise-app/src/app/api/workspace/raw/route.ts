import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { lookup as mimeLookup } from "mime-types";

/**
 * Serve a workspace file as binary with the right Content-Type.
 * Used by the preview drawer for PDFs, images, HTML, video, audio, anything
 * whose renderer wants a URL rather than a fetched body.
 *
 * Path traversal protection: the resolved abs path must stay inside the workspace root.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const workspace = url.searchParams.get("workspace");
  const relPath = url.searchParams.get("path");
  if (!workspace || !relPath) {
    return NextResponse.json({ error: "workspace and path required" }, { status: 400 });
  }
  const wsRoot = path.resolve(workspace);
  const abs = path.resolve(wsRoot, relPath);
  if (!abs.startsWith(wsRoot)) {
    return NextResponse.json({ error: "Path traversal denied" }, { status: 403 });
  }
  try {
    const data = await fs.readFile(abs);
    const mt = (mimeLookup(abs) as string) || "application/octet-stream";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mt,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 404 });
  }
}
