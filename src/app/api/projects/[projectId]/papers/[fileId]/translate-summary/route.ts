import { NextResponse } from "next/server";
import { translatePaperSummaryToKorean } from "@/lib/llm";
import { readOrCreateGraph, storage } from "@/lib/storage";
import type { PaperNode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const { projectId, fileId } = await params;
    const graph = await readOrCreateGraph(projectId);
    const target = graph.nodes.find((paper) => paper.id === fileId);
    if (!target) {
      return NextResponse.json({ success: false, error: "PAPER_NOT_FOUND" }, { status: 404 });
    }

    if (target.summaryKo && target.shortSummaryKo) {
      return NextResponse.json({ success: true, paper: target, graph });
    }

    const translation = await translatePaperSummaryToKorean({
      title: target.title,
      summary: target.summary,
      shortSummary: target.shortSummary,
      keywords: target.keywords
    });
    const timestamp = new Date().toISOString();
    let updatedPaper: PaperNode | null = null;
    const nextGraph = {
      ...graph,
      nodes: graph.nodes.map((paper) => {
        if (paper.id !== target.id) return paper;
        updatedPaper = {
          ...paper,
          summaryKo: translation.summaryKo,
          shortSummaryKo: translation.shortSummaryKo,
          translationUpdatedAt: timestamp,
          updatedAt: timestamp
        };
        return updatedPaper;
      }),
      updatedAt: timestamp
    };

    await storage.writeGraph(projectId, nextGraph);
    return NextResponse.json({ success: true, paper: updatedPaper, graph: nextGraph });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
