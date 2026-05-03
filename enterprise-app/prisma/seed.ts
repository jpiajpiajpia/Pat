import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "local@nexus.internal" } });
  if (existing) return;

  await prisma.user.create({
    data: {
      name: "Local User",
      email: "local@nexus.internal",
      avatarInitials: "LU",
      settings: {
        create: {
          defaultStrength: 2,
          theme: "system",
          systemPrompt: "You are a helpful enterprise AI assistant. Be concise, accurate, and professional.",
        },
      },
    },
  });

  console.log("Default user created.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
