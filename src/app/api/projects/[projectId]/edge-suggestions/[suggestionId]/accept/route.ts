import { NextResponse } from "next/server";
import { acceptSuggestion } from "@/lib/merge";
import { readOrCreateGraph, storage } from "@/lib/storage";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ projectId: string; suggestionId: string }> }
) {
  try {
    const { projectId, suggestionId } = await params;
    const graph = acceptSuggestion(await readOrCreateGraph(projectId), suggestionId);
    await storage.writeGraph(projectId, graph);
    return NextResponse.json({ success: true, graph });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "SUGGESTION_NOT_FOUND" ? 404 : 500 }
    );
  }
}
