import { NextResponse } from "next/server";
import { readOrCreateGraph } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const graph = await readOrCreateGraph(projectId);
  return NextResponse.json({ success: true, graph });
}
