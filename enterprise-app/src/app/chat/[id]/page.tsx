import { prisma } from "@/lib/prisma";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) notFound();

  const initialMessages = conversation.messages.map((m) => {
    const base = { id: m.id, role: m.role as "user" | "assistant", content: m.content };
    if (m.attachedFileIds) {
      try {
        const attachedFiles = JSON.parse(m.attachedFileIds) as Array<{
          id: string;
          filename: string;
          mimeType: string;
          sizeBytes?: number;
        }>;
        return { ...base, data: { attachedFiles } };
      } catch {
        // ignore malformed
      }
    }
    return base;
  });

  return <ChatWindow conversationId={id} initialMessages={initialMessages} />;
}
