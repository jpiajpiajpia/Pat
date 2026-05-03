import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? "";
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  return NextResponse.json(conversations);
}

export async function POST(req: Request) {
  const { userId, mode } = await req.json();
  const conversation = await prisma.conversation.create({
    data: { userId, mode: mode ?? "chat", title: "New conversation" },
  });
  return NextResponse.json(conversation);
}
