import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverMcpTools } from "@/lib/mcp";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await prisma.mcpServer.findUnique({ where: { id } });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const tools = await discoverMcpTools(server.url, server.authType, server.authValue);
    await prisma.mcpServer.update({ where: { id }, data: { tools: JSON.stringify(tools) } });
    return NextResponse.json({ ok: true, toolCount: tools.length, tools });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
