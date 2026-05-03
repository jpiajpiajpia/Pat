import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

const BLOCKED = [/rm\s+-rf\s+\//, /mkfs/, /dd\s+if=/, /:\(\)\{.*\}/, /chmod\s+777\s+\//];

function isDangerous(cmd: string): boolean {
  return BLOCKED.some((pattern) => pattern.test(cmd));
}

export async function POST(req: NextRequest) {
  const { command, workspace, approved } = await req.json();

  if (!command) return NextResponse.json({ error: "command required" }, { status: 400 });

  if (isDangerous(command)) {
    return NextResponse.json({ error: "Command blocked: potentially destructive" }, { status: 403 });
  }

  if (!approved) {
    return NextResponse.json({ requiresApproval: true, command }, { status: 202 });
  }

  const cwd = workspace && path.isAbsolute(workspace) ? workspace : process.cwd();

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 2,
    });
    return NextResponse.json({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    return NextResponse.json({
      stdout: e.stdout?.trim() ?? "",
      stderr: e.stderr?.trim() ?? e.message ?? String(err),
      exitCode: e.code ?? 1,
    });
  }
}
