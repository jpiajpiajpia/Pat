import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? "";
  const servers = await prisma.mcpServer.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(servers);
}

export async function POST(req: Request) {
  const { userId, name, url, authType, authValue } = await req.json();
  const server = await prisma.mcpServer.create({
    data: { userId, name, url, authType: authType ?? "none", authValue: authValue ?? null },
  });
  return NextResponse.json(server);
}
