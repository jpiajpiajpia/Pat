import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let user = await prisma.user.findFirst({ include: { settings: true } });

  // Auto-seed a default user on first launch (fresh DB)
  if (!user) {
    user = await prisma.user.create({
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
      include: { settings: true },
    });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const { userId, name, settings } = await req.json();
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      settings: settings
        ? {
            upsert: {
              create: settings,
              update: settings,
            },
          }
        : undefined,
    },
    include: { settings: true },
  });
  return NextResponse.json(user);
}
