import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";

/**
 * Serve an uploaded file as binary with the right Content-Type.
 * Used by the preview drawer when the user attached a file and wants to view it.
 */
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const data = await fs.readFile(upload.path);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": upload.mimeType || "application/octet-stream",
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 404 });
  }
}
