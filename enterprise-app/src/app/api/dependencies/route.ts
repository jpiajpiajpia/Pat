import { NextResponse } from "next/server";
import { MODEL_CATALOG } from "@/lib/modelCatalog";

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

interface OllamaModel { name: string; size: number; modified_at: string; }

export async function GET() {
  const result = {
    ollama: { running: false, version: null as string | null, baseUrl: OLLAMA_BASE },
    models: [] as Array<{
      id: string;
      displayName: string;
      role: string;
      sizeGB: number;
      description: string;
      recommended: boolean;
      required: boolean;
      installed: boolean;
      installedSizeBytes?: number;
    }>,
  };

  // Check Ollama is running + version
  try {
    const versionRes = await fetch(`${OLLAMA_BASE}/api/version`, { signal: AbortSignal.timeout(2000) });
    if (versionRes.ok) {
      const v = await versionRes.json() as { version: string };
      result.ollama.running = true;
      result.ollama.version = v.version;
    }
  } catch {
    // Ollama is not running
  }

  // Fetch installed models if Ollama is running
  let installedModels: OllamaModel[] = [];
  if (result.ollama.running) {
    try {
      const tagsRes = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (tagsRes.ok) {
        const data = await tagsRes.json() as { models: OllamaModel[] };
        installedModels = data.models;
      }
    } catch {
      // Could not fetch installed models
    }
  }

  // Match catalog against installed
  result.models = MODEL_CATALOG.map((m) => {
    // Ollama tags include both "name:tag" and "name" forms; match exact id
    const installed = installedModels.find(
      (im) => im.name === m.id || im.name === `${m.id}:latest`
    );
    return {
      id: m.id,
      displayName: m.displayName,
      role: m.role,
      sizeGB: m.sizeGB,
      description: m.description,
      recommended: !!m.recommended,
      required: !!m.required,
      installed: !!installed,
      installedSizeBytes: installed?.size,
    };
  });

  return NextResponse.json(result);
}
