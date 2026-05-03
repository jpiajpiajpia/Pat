import { prisma } from "./prisma";
import { embed, cosineSimilarity } from "./embeddings";

export interface MemoryEntry {
  id: string;
  content: string;
  source: string;
  score?: number;
  createdAt: Date;
}

export async function saveMemory(
  userId: string,
  content: string,
  source: "manual" | "conversation" = "manual"
): Promise<MemoryEntry> {
  const embedding = await embed(content);
  const record = await prisma.memory.create({
    data: {
      userId,
      content,
      source,
      embedding: JSON.stringify(embedding),
    },
  });
  return { id: record.id, content: record.content, source: record.source, createdAt: record.createdAt };
}

export async function searchMemories(
  userId: string,
  query: string,
  topK = 5,
  threshold = 0.4
): Promise<MemoryEntry[]> {
  const queryEmbedding = await embed(query);
  const all = await prisma.memory.findMany({ where: { userId } });

  const scored = all
    .map((m) => ({
      id: m.id,
      content: m.content,
      source: m.source,
      createdAt: m.createdAt,
      score: cosineSimilarity(queryEmbedding, JSON.parse(m.embedding) as number[]),
    }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export async function listMemories(userId: string): Promise<MemoryEntry[]> {
  const all = await prisma.memory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return all.map((m) => ({
    id: m.id,
    content: m.content,
    source: m.source,
    createdAt: m.createdAt,
  }));
}

export async function deleteMemory(id: string, userId: string): Promise<void> {
  await prisma.memory.deleteMany({ where: { id, userId } });
}
