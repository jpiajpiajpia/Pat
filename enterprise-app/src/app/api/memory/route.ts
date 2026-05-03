import { NextRequest, NextResponse } from "next/server";
import { saveMemory, searchMemories, listMemories } from "@/lib/memoryStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const query = searchParams.get("q");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  if (query) {
    const results = await searchMemories(userId, query);
    return NextResponse.json(results);
  }

  const memories = await listMemories(userId);
  return NextResponse.json(memories);
}

export async function POST(req: NextRequest) {
  const { userId, content, source } = await req.json();
  if (!userId || !content) return NextResponse.json({ error: "userId and content required" }, { status: 400 });

  const memory = await saveMemory(userId, content, source ?? "manual");
  return NextResponse.json(memory);
}
