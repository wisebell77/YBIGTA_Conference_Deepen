import { NextResponse } from "next/server";
import { createUserEdge } from "@/lib/merge";
import { readOrCreateGraph, storage } from "@/lib/storage";
import { RELATION_LABELS, type DirectionMeaning, type RelationType } from "@/lib/types";

type EdgeCreate = {
  source?: string;
  target?: string;
  directed?: boolean;
  directionMeaning?: DirectionMeaning;
  relationType?: RelationType;
  label?: string;
  shortDescription?: string;
  longDescription?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = (await request.json()) as EdgeCreate;
    if (!body.source || !body.target) {
      return NextResponse.json({ success: false, error: "EDGE_ENDPOINT_REQUIRED" }, { status: 400 });
    }
    if (!body.relationType || !(body.relationType in RELATION_LABELS)) {
      return NextResponse.json({ success: false, error: "INVALID_RELATION_TYPE" }, { status: 400 });
    }

    const graph = await readOrCreateGraph(projectId);
    const result = createUserEdge(graph, {
      source: body.source,
      target: body.target,
      directed: body.directed ?? true,
      directionMeaning: body.directionMeaning,
      relationType: body.relationType,
      label: body.label?.trim() || RELATION_LABELS[body.relationType],
      shortDescription: body.shortDescription?.trim() || "User-created relationship.",
      longDescription: body.longDescription?.trim() || "This relationship was manually created by the user."
    });

    await storage.writeGraph(projectId, result.graph);
    return NextResponse.json({ success: true, edge: result.edge, graph: result.graph });
  } catch (error) {
    const message = (error as Error).message;
    const status =
      message === "INVALID_EDGE_ENDPOINT" || message === "SELF_EDGE_NOT_ALLOWED" ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
