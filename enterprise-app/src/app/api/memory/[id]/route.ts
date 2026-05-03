import { NextRequest, NextResponse } from "next/server";
import { deleteMemory } from "@/lib/memoryStore";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  await deleteMemory(id, userId);
  return NextResponse.json({ ok: true });
}
