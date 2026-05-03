import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(`${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/tags`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ models: [] });
  }
}
