import { NextRequest, NextResponse } from "next/server";
import { listSkills, createSkill } from "@/lib/skills";

export async function GET() {
  const skills = await listSkills();
  return NextResponse.json({ skills });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body.name ?? "").toString().trim();
  const description = (body.description ?? "").toString().trim();
  const skillBody = (body.body ?? "").toString();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const skill = await createSkill({ name, description, body: skillBody });
  return NextResponse.json(skill);
}
