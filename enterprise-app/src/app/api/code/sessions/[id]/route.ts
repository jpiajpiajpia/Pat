import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.codeSession.findUnique({
    where: { id },
    include: { steps: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  const session = await prisma.codeSession.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.workspace !== undefined && { workspace: data.workspace }),
      ...(data.status !== undefined && { status: data.status }),
      updatedAt: new Date(),
    },
  });
  return NextResponse.json(session);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.codeSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
