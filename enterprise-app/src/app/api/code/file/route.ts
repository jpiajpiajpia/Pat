import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

function safePath(workspace: string, relPath: string): string | null {
  const abs = path.resolve(workspace, relPath);
  // Prevent path traversal outside workspace
  if (!abs.startsWith(path.resolve(workspace))) return null;
  return abs;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const workspace = searchParams.get("workspace") ?? "";
  const relPath = searchParams.get("path") ?? ".";
  const op = searchParams.get("op") ?? "read";

  if (!workspace) return NextResponse.json({ error: "workspace required" }, { status: 400 });

  const abs = safePath(workspace, relPath);
  if (!abs) return NextResponse.json({ error: "Path traversal denied" }, { status: 403 });

  try {
    if (op === "list") {
      const entries = await fs.readdir(abs, { withFileTypes: true });
      return NextResponse.json(
        entries.map((e) => ({ name: e.name, type: e.isDirectory() ? "dir" : "file", path: path.join(relPath, e.name) }))
      );
    }

    if (op === "read") {
      const content = await fs.readFile(abs, "utf-8");
      return NextResponse.json({ content });
    }

    if (op === "exists") {
      return NextResponse.json({ exists: existsSync(abs) });
    }

    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { workspace, path: relPath, content, op } = await req.json();

  if (!workspace || !relPath) return NextResponse.json({ error: "workspace and path required" }, { status: 400 });

  const abs = safePath(workspace, relPath);
  if (!abs) return NextResponse.json({ error: "Path traversal denied" }, { status: 403 });

  try {
    if (op === "write" || !op) {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content ?? "", "utf-8");
      return NextResponse.json({ ok: true });
    }

    if (op === "mkdir") {
      await fs.mkdir(abs, { recursive: true });
      return NextResponse.json({ ok: true });
    }

    if (op === "delete") {
      await fs.rm(abs, { recursive: true, force: true });
      return NextResponse.json({ ok: true });
    }

    if (op === "edit") {
      // Targeted string replacement
      const { oldString, newString } = await req.json();
      const current = await fs.readFile(abs, "utf-8");
      if (!current.includes(oldString)) {
        return NextResponse.json({ error: "old_string not found in file" }, { status: 400 });
      }
      await fs.writeFile(abs, current.replace(oldString, newString), "utf-8");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
