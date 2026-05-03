/**
 * File-based skills store. Each skill is a single .md file in:
 *   ~/Library/Application Support/nexus/skills/<id>.md
 *
 * Format (YAML frontmatter + markdown body):
 *
 *   ---
 *   name: Code Review
 *   description: Reviews code for security, performance, best practices
 *   ---
 *   You are now in code-review mode...
 *
 * The id is the filename without .md. Users can also edit these files
 * directly in any editor — they're plain text.
 */
import fs from "fs/promises";
import path from "path";
import os from "os";

const SKILLS_DIR = path.join(os.homedir(), "Library", "Application Support", "nexus", "skills");

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  /** Source path on disk (for "edit externally" affordances) */
  path: string;
  updatedAt: string;
}

async function ensureDir() {
  await fs.mkdir(SKILLS_DIR, { recursive: true });
}

function safeId(input: string): string {
  // sanitize to a safe filename: lowercase, alphanumeric + dashes
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "skill";
}

function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[k] = v;
  }
  return { meta, body: m[2] };
}

function buildFile(name: string, description: string, body: string): string {
  // Escape any embedded `---` lines in the body so frontmatter stays parseable
  const safeBody = body.replace(/^---$/gm, "\\---");
  return `---\nname: ${name.replace(/\n/g, " ")}\ndescription: ${description.replace(/\n/g, " ")}\n---\n${safeBody}\n`;
}

export async function listSkills(): Promise<Skill[]> {
  await ensureDir();
  const entries = await fs.readdir(SKILLS_DIR);
  const skills: Skill[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(SKILLS_DIR, entry);
    try {
      const stat = await fs.stat(filePath);
      const text = await fs.readFile(filePath, "utf-8");
      const { meta, body } = parseFrontmatter(text);
      const id = entry.replace(/\.md$/, "");
      skills.push({
        id,
        name: meta.name || id,
        description: meta.description || (body.split("\n")[0] || "").slice(0, 140),
        body: body.trim(),
        path: filePath,
        updatedAt: stat.mtime.toISOString(),
      });
    } catch {
      // skip unreadable files
    }
  }
  // Most recently updated first
  return skills.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSkill(id: string): Promise<Skill | null> {
  await ensureDir();
  const filePath = path.join(SKILLS_DIR, `${safeId(id)}.md`);
  try {
    const stat = await fs.stat(filePath);
    const text = await fs.readFile(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(text);
    return {
      id: safeId(id),
      name: meta.name || id,
      description: meta.description || "",
      body: body.trim(),
      path: filePath,
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getSkillsByIds(ids: string[]): Promise<Skill[]> {
  const out: Skill[] = [];
  for (const id of ids) {
    const s = await getSkill(id);
    if (s) out.push(s);
  }
  return out;
}

export async function createSkill(input: { name: string; description: string; body: string }): Promise<Skill> {
  await ensureDir();
  // Pick a unique id based on name
  const baseId = safeId(input.name);
  let id = baseId;
  let i = 2;
  while (true) {
    try {
      await fs.access(path.join(SKILLS_DIR, `${id}.md`));
      id = `${baseId}-${i++}`;
    } catch {
      break;
    }
  }
  const filePath = path.join(SKILLS_DIR, `${id}.md`);
  await fs.writeFile(filePath, buildFile(input.name, input.description, input.body), "utf-8");
  return (await getSkill(id))!;
}

export async function updateSkill(id: string, input: { name: string; description: string; body: string }): Promise<Skill | null> {
  await ensureDir();
  const filePath = path.join(SKILLS_DIR, `${safeId(id)}.md`);
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }
  await fs.writeFile(filePath, buildFile(input.name, input.description, input.body), "utf-8");
  return getSkill(id);
}

export async function deleteSkill(id: string): Promise<boolean> {
  await ensureDir();
  const filePath = path.join(SKILLS_DIR, `${safeId(id)}.md`);
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Compose a system-prompt section from a list of active skills. */
export function renderSkillsBlock(skills: Skill[]): string {
  if (skills.length === 0) return "";
  return (
    "\n\n## Active skills\n\nThe user has activated the following skill(s) for this message. Follow their instructions on top of your normal behavior.\n\n" +
    skills.map((s) => `### ${s.name}\n${s.body}`).join("\n\n---\n\n")
  );
}
