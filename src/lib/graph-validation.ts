import type {
  DirectionMeaning,
  EdgeEvidence,
  EdgeSuggestion,
  PaperEdge,
  PaperNode,
  RelationSource,
  RelationType
} from "./types";
import { RELATION_LABELS } from "./types";

const DIRECTION_MEANINGS = new Set<DirectionMeaning>([
  "knowledge_flow",
  "citation_direction",
  "undirected_conceptual_similarity",
  "unknown"
]);

const RELATION_SOURCES = new Set<RelationSource>(["citation_based", "semantic_inference"]);

const EVIDENCE_TYPES = new Set<EdgeEvidence["type"]>([
  "citation_context",
  "abstract_similarity",
  "method_similarity",
  "keyword_overlap",
  "llm_reasoning"
]);

type RawRelationEdge = Omit<
  PaperEdge,
  "id" | "llmGenerated" | "userEdited" | "locked" | "createdAt" | "updatedAt"
>;

type RawSuggestion = Omit<EdgeSuggestion, "id" | "status" | "createdAt"> & {
  targetEdgeId?: string | null;
};

export type NormalizedRelationResult = {
  edges: RawRelationEdge[];
  suggestions: RawSuggestion[];
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asConfidence(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function normalizeRelationType(value: unknown): RelationType {
  const candidate = asString(value);
  return candidate in RELATION_LABELS ? (candidate as RelationType) : "unknown";
}

function normalizeDirectionMeaning(value: unknown): DirectionMeaning {
  const candidate = asString(value) as DirectionMeaning;
  return DIRECTION_MEANINGS.has(candidate) ? candidate : "unknown";
}

function normalizeRelationSource(value: unknown): RelationSource {
  const candidate = asString(value) as RelationSource;
  return RELATION_SOURCES.has(candidate) ? candidate : "semantic_inference";
}

function normalizeEvidence(value: unknown, validIds: Set<string>): EdgeEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): EdgeEvidence | null => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const paperId = asString(source.paperId);
      const type = asString(source.type) as EdgeEvidence["type"];
      const text = asString(source.text);
      if (!validIds.has(paperId) || !text) return null;
      return {
        paperId,
        type: EVIDENCE_TYPES.has(type) ? type : "llm_reasoning",
        text: text.slice(0, 1000)
      };
    })
    .filter((item): item is EdgeEvidence => item !== null);
}

function edgeTouchesNewPaper(edge: Pick<PaperEdge, "source" | "target">, newPaperId: string): boolean {
  return edge.source === newPaperId || edge.target === newPaperId;
}

export function normalizeRelationExtraction(params: {
  rawEdges: unknown;
  rawSuggestions: unknown;
  newPaper: PaperNode;
  candidates: PaperNode[];
  existingEdges: PaperEdge[];
  edgeLimit: number;
}): NormalizedRelationResult {
  const validPaperIds = new Set([params.newPaper.id, ...params.candidates.map((paper) => paper.id)]);
  const existingEdgeIds = new Set(params.existingEdges.map((edge) => edge.id));

  const edges = (Array.isArray(params.rawEdges) ? params.rawEdges : [])
    .map((item): RawRelationEdge | null => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const edge = {
        source: asString(source.source),
        target: asString(source.target),
        directed: asBoolean(source.directed),
        directionMeaning: normalizeDirectionMeaning(source.directionMeaning),
        relationType: normalizeRelationType(source.relationType),
        label: asString(source.label, RELATION_LABELS.unknown),
        shortDescription: asString(source.shortDescription),
        longDescription: asString(source.longDescription),
        relationSource: normalizeRelationSource(source.relationSource),
        confidence: asConfidence(source.confidence),
        evidence: normalizeEvidence(source.evidence, validPaperIds)
      };
      if (
        edge.source === edge.target ||
        !validPaperIds.has(edge.source) ||
        !validPaperIds.has(edge.target) ||
        !edgeTouchesNewPaper(edge, params.newPaper.id)
      ) {
        return null;
      }
      return edge;
    })
    .filter((edge): edge is RawRelationEdge => edge !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, params.edgeLimit);

  const suggestions = (Array.isArray(params.rawSuggestions) ? params.rawSuggestions : [])
    .map((item): RawSuggestion | null => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const suggestion = {
        targetEdgeId: asString(source.targetEdgeId) || undefined,
        source: asString(source.source),
        target: asString(source.target),
        suggestedRelationType: normalizeRelationType(source.suggestedRelationType),
        suggestedLabel: asString(source.suggestedLabel, RELATION_LABELS.unknown),
        suggestedShortDescription: asString(source.suggestedShortDescription),
        suggestedLongDescription: asString(source.suggestedLongDescription),
        reason: asString(source.reason, "Stored as a suggestion because it should not overwrite the graph."),
        confidence: asConfidence(source.confidence)
      };
      if (
        suggestion.source === suggestion.target ||
        !validPaperIds.has(suggestion.source) ||
        !validPaperIds.has(suggestion.target) ||
        !edgeTouchesNewPaper(suggestion, params.newPaper.id)
      ) {
        return null;
      }
      if (suggestion.targetEdgeId && !existingEdgeIds.has(suggestion.targetEdgeId)) {
        return { ...suggestion, targetEdgeId: undefined };
      }
      return suggestion;
    })
    .filter((suggestion): suggestion is RawSuggestion => suggestion !== null);

  return { edges, suggestions };
}
