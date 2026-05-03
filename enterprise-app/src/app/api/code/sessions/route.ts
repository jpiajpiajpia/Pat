import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const sessions = await prisma.codeSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, workspace: true, status: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const { userId, workspace } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const session = await prisma.codeSession.create({
    data: { userId, workspace: workspace ?? "" },
  });
  return NextResponse.json(session);
}
