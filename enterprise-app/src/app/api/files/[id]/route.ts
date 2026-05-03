import { NextRequest } from "next/server";
import { readGeneratedFile } from "@/lib/tools/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const file = await readGeneratedFile(id);
    if (!file) return new Response("Not found", { status: 404 });

    // Convert Buffer → Uint8Array for the Web Response API
    const ab = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength
    ) as ArrayBuffer;

    return new Response(ab, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Content-Length": String(file.buffer.length),
      },
    });
  } catch (err) {
    console.error("[files/:id] error:", err);
    return new Response(`Error: ${String(err)}`, { status: 500 });
  }
}
