import { NextResponse } from "next/server";
import { applyEdgeUpdate, deleteEdge } from "@/lib/merge";
import { readOrCreateGraph, storage } from "@/lib/storage";
import { RELATION_LABELS, type RelationType } from "@/lib/types";

type EdgePatch = {
  relationType?: RelationType;
  label?: string;
  shortDescription?: string;
  longDescription?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; edgeId: string }> }
) {
  try {
    const { projectId, edgeId } = await params;
    const body = (await request.json()) as EdgePatch;
    if (!body.relationType || !(body.relationType in RELATION_LABELS)) {
      return NextResponse.json({ success: false, error: "INVALID_RELATION_TYPE" }, { status: 400 });
    }

    const graph = await readOrCreateGraph(projectId);
    const result = applyEdgeUpdate(graph, edgeId, {
      relationType: body.relationType,
      label: body.label ?? RELATION_LABELS[body.relationType],
      shortDescription: body.shortDescription ?? "",
      longDescription: body.longDescription ?? ""
    });
    await storage.writeGraph(projectId, result.graph);
    return NextResponse.json({ success: true, edge: result.edge, graph: result.graph });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "EDGE_NOT_FOUND" ? 404 : 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ projectId: string; edgeId: string }> }
) {
  try {
    const { projectId, edgeId } = await params;
    const graph = deleteEdge(await readOrCreateGraph(projectId), edgeId);
    await storage.writeGraph(projectId, graph);
    return NextResponse.json({ success: true, graph });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "EDGE_NOT_FOUND" ? 404 : 500 }
    );
  }
}
