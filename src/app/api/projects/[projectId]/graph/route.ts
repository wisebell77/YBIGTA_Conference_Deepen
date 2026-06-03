import { NextResponse } from "next/server";
import { readOrCreateGraph, storage } from "@/lib/storage";
import {
  createEmptyGraph,
  DEFAULT_ANALYSIS_SETTINGS,
  RELATION_TYPES,
  type AnalysisSettings,
  type EdgeLineStyle,
  type GraphUiSettings,
  type RelationType
} from "@/lib/types";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const graph = await readOrCreateGraph(projectId);
    return NextResponse.json({ success: true, graph });
  } catch (error) {
    if ((error as Error).message === "GOOGLE_DRIVE_NOT_CONNECTED") {
      return NextResponse.json({ success: true, graph: createEmptyGraph(projectId) });
    }
    throw error;
  }
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isEdgeLineStyle(value: unknown): value is EdgeLineStyle {
  return value === "solid" || value === "dashed" || value === "dotted";
}

function normalizeUiSettings(value: unknown): GraphUiSettings {
  const input = value as {
    edgeColors?: Record<string, unknown>;
    edgeLineStyles?: Record<string, unknown>;
    nodeShapeMode?: unknown;
    showEdgeLabels?: unknown;
    freeMoveMode?: unknown;
    nodePositions?: Record<string, unknown>;
  } | null;
  const edgeColors: Partial<Record<RelationType, string>> = {};
  const edgeLineStyles: Partial<Record<RelationType, EdgeLineStyle>> = {};
  const nodePositions: NonNullable<GraphUiSettings["nodePositions"]> = {};
  const output: GraphUiSettings = {};

  if (input?.edgeColors && typeof input.edgeColors === "object") {
    for (const relationType of RELATION_TYPES) {
      const color = input.edgeColors[relationType];
      if (isHexColor(color)) edgeColors[relationType] = color;
    }
    output.edgeColors = edgeColors;
  }
  if (input?.edgeLineStyles && typeof input.edgeLineStyles === "object") {
    for (const relationType of RELATION_TYPES) {
      const lineStyle = input.edgeLineStyles[relationType];
      if (isEdgeLineStyle(lineStyle)) edgeLineStyles[relationType] = lineStyle;
    }
    output.edgeLineStyles = edgeLineStyles;
  }

  if (input?.nodeShapeMode === "square" || input?.nodeShapeMode === "circle") {
    output.nodeShapeMode = input.nodeShapeMode;
  }
  if (typeof input?.showEdgeLabels === "boolean") {
    output.showEdgeLabels = input.showEdgeLabels;
  }
  if (typeof input?.freeMoveMode === "boolean") {
    output.freeMoveMode = input.freeMoveMode;
  }
  if (input?.nodePositions && typeof input.nodePositions === "object") {
    for (const [nodeId, position] of Object.entries(input.nodePositions)) {
      const candidate = position as { x?: unknown; y?: unknown };
      if (
        typeof candidate.x === "number" &&
        Number.isFinite(candidate.x) &&
        typeof candidate.y === "number" &&
        Number.isFinite(candidate.y)
      ) {
        nodePositions[nodeId] = { x: candidate.x, y: candidate.y };
      }
    }
    output.nodePositions = nodePositions;
  }

  return output;
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAnalysisSettings(
  value: unknown,
  current: AnalysisSettings
): AnalysisSettings {
  const input = value as Partial<Record<keyof AnalysisSettings, unknown>> | null;
  if (!input || typeof input !== "object") return current;

  return {
    ...current,
    semanticEdgeLimitPerPaper: Math.round(
      clamp(finiteNumber(input.semanticEdgeLimitPerPaper, current.semanticEdgeLimitPerPaper), 1, 20)
    ),
    candidateLimitPerNewPaper: Math.round(
      clamp(finiteNumber(input.candidateLimitPerNewPaper, current.candidateLimitPerNewPaper), 1, 50)
    ),
    minConfidenceForAutoEdge: clamp(
      finiteNumber(input.minConfidenceForAutoEdge, current.minConfidenceForAutoEdge),
      0,
      1
    ),
    minConfidenceForSuggestion: clamp(
      finiteNumber(input.minConfidenceForSuggestion, current.minConfidenceForSuggestion),
      0,
      1
    ),
    candidateTitleWeight: clamp(
      finiteNumber(input.candidateTitleWeight, current.candidateTitleWeight),
      0,
      10
    ),
    candidateKeywordWeight: clamp(
      finiteNumber(input.candidateKeywordWeight, current.candidateKeywordWeight),
      0,
      10
    ),
    candidateSummaryWeight: clamp(
      finiteNumber(input.candidateSummaryWeight, current.candidateSummaryWeight),
      0,
      10
    ),
    candidateMinScore: clamp(
      finiteNumber(input.candidateMinScore, current.candidateMinScore),
      0,
      1
    ),
    includeZeroScoreCandidates:
      typeof input.includeZeroScoreCandidates === "boolean"
        ? input.includeZeroScoreCandidates
        : current.includeZeroScoreCandidates,
    customEdgePrompt:
      typeof input.customEdgePrompt === "string"
        ? input.customEdgePrompt.slice(0, 4000)
        : current.customEdgePrompt
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = (await request.json()) as { uiSettings?: unknown; analysisSettings?: unknown };
    const graph = await readOrCreateGraph(projectId);
    const currentAnalysisSettings = {
      ...DEFAULT_ANALYSIS_SETTINGS,
      ...graph.analysisSettings
    };
    const nextGraph = {
      ...graph,
      analysisSettings: normalizeAnalysisSettings(
        body.analysisSettings,
        currentAnalysisSettings
      ),
      uiSettings: {
        ...graph.uiSettings,
        ...normalizeUiSettings(body.uiSettings)
      },
      updatedAt: new Date().toISOString()
    };

    await storage.writeGraph(projectId, nextGraph);
    return NextResponse.json({ success: true, graph: nextGraph });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
