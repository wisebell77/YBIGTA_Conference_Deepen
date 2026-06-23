import { NextResponse } from "next/server";
import { chatWithGraph } from "@/lib/chat";
import { readOrCreateGraph } from "@/lib/storage";
import type { GraphChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function normalizeMessages(value: unknown): GraphChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): GraphChatMessage | null => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const role = source.role === "assistant" ? "assistant" : source.role === "user" ? "user" : null;
      const content = typeof source.content === "string" ? source.content.trim() : "";
      if (!role || !content) return null;
      return { role, content: content.slice(0, 4000) };
    })
    .filter((message): message is GraphChatMessage => message !== null)
    .slice(-12);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = (await request.json()) as { messages?: unknown };
    const messages = normalizeMessages(body.messages);
    if (!messages.length || messages[messages.length - 1]?.role !== "user") {
      return NextResponse.json({ success: false, error: "USER_MESSAGE_REQUIRED" }, { status: 400 });
    }

    const graph = await readOrCreateGraph(projectId);
    const result = await chatWithGraph({ graph, messages });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
