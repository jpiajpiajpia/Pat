import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(conversation);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const conversation = await prisma.conversation.update({
    where: { id },
    data: { title: body.title, mode: body.mode },
  });
  return NextResponse.json(conversation);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.conversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, content, attachedFiles } = await req.json();
  // attachedFiles: optional array of { id, filename, mimeType, sizeBytes }
  const message = await prisma.message.create({
    data: {
      conversationId: id,
      role,
      content,
      attachedFileIds: Array.isArray(attachedFiles) && attachedFiles.length > 0
        ? JSON.stringify(attachedFiles)
        : null,
    },
  });
  return NextResponse.json(message);
}
