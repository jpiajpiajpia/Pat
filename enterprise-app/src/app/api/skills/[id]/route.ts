import { NextRequest, NextResponse } from "next/server";
import { getSkill, updateSkill, deleteSkill } from "@/lib/skills";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const skill = await getSkill(id);
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(skill);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const name = (body.name ?? "").toString().trim();
  const description = (body.description ?? "").toString().trim();
  const skillBody = (body.body ?? "").toString();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const skill = await updateSkill(id, { name, description, body: skillBody });
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(skill);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteSkill(id);
  return NextResponse.json({ ok });
}
