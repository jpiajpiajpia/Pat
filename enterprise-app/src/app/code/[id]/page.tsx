import { CodeWindow } from "@/components/code/CodeWindow";

interface Props { params: Promise<{ id: string }>; }

export default async function CodeSessionPage({ params }: Props) {
  const { id } = await params;
  return <CodeWindow sessionId={id} />;
}
