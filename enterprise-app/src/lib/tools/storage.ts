import fs from "fs/promises";
import path from "path";
import os from "os";
import { prisma } from "@/lib/prisma";

function getGeneratedRoot(): string {
  // In Electron: ~/Library/Application Support/nexus/generated
  // In dev: ./data/generated
  if (process.env.NEXUS_USER_DATA) {
    return path.join(process.env.NEXUS_USER_DATA, "generated");
  }
  // Fall back to platform default
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "nexus", "generated");
  }
  return path.join(process.cwd(), "data", "generated");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export interface SaveFileArgs {
  conversationId?: string | null;
  filename: string;       // requested name (will be sanitized + may be made unique)
  mimeType: string;
  toolName: string;
  content: Buffer | string;
}

export interface SavedFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  path: string;
}

export async function saveGeneratedFile(args: SaveFileArgs): Promise<SavedFile> {
  const folder = path.join(getGeneratedRoot(), args.conversationId || "loose");
  await fs.mkdir(folder, { recursive: true });

  const buffer = Buffer.isBuffer(args.content) ? args.content : Buffer.from(args.content, "utf-8");
  const safeName = sanitizeFilename(args.filename);
  const finalPath = path.join(folder, safeName);
  await fs.writeFile(finalPath, buffer);

  const record = await prisma.generatedFile.create({
    data: {
      conversationId: args.conversationId || null,
      filename: safeName,
      mimeType: args.mimeType,
      sizeBytes: buffer.length,
      toolName: args.toolName,
      path: finalPath,
    },
  });

  return {
    id: record.id,
    filename: record.filename,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    downloadUrl: `/api/files/${record.id}`,
    path: record.path,
  };
}

export async function readGeneratedFile(id: string): Promise<{ buffer: Buffer; filename: string; mimeType: string } | null> {
  const record = await prisma.generatedFile.findUnique({ where: { id } });
  if (!record) return null;
  try {
    const buffer = await fs.readFile(record.path);
    return { buffer, filename: record.filename, mimeType: record.mimeType };
  } catch {
    return null;
  }
}
