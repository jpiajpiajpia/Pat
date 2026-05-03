import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const server = await prisma.mcpServer.update({ where: { id }, data: body });
  return NextResponse.json(server);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.mcpServer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
