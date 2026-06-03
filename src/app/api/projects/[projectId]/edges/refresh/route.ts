import { NextResponse } from "next/server";
import { refreshGeneratedEdges } from "@/lib/refresh-edges";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const result = await refreshGeneratedEdges(projectId);
    return NextResponse.json({
      success: true,
      graph: result.graph,
      stats: result.stats
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
