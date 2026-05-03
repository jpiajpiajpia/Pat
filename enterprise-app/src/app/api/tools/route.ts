import { NextResponse } from "next/server";
import { TOOL_CATALOG, TOOL_CAPABLE_MODELS } from "@/lib/tools/registry";

export async function GET() {
  return NextResponse.json({
    tools: TOOL_CATALOG.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      category: t.category,
      uiHint: t.uiHint,
    })),
    capableModels: Array.from(TOOL_CAPABLE_MODELS),
  });
}
