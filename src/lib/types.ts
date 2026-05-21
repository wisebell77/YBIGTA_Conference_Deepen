export type RelationType =
  | "extends"
  | "prerequisite"
  | "supports"
  | "contradicts"
  | "applies"
  | "uses_method"
  | "compares_with"
  | "conceptually_related"
  | "background"
  | "unknown";

export type RelationSource =
  | "citation_based"
  | "semantic_inference"
  | "user_created"
  | "user_edited";

export type DirectionMeaning =
  | "knowledge_flow"
  | "citation_direction"
  | "undirected_conceptual_similarity"
  | "unknown";

export type EdgeEvidence = {
  paperId: string;
  type:
    | "citation_context"
    | "abstract_similarity"
    | "method_similarity"
    | "keyword_overlap"
    | "llm_reasoning";
  text: string;
};

export type PaperNode = {
  id: string;
  type: "paper";
  title: string;
  authors: string[];
  year?: number;
  abstract?: string;
  summary: string;
  shortSummary: string;
  keywords: string[];
  embeddingText: string;
  localFileId?: string;
  driveFileId?: string;
  localFilePath?: string;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
};

export type PaperEdge = {
  id: string;
  source: string;
  target: string;
  directed: boolean;
  directionMeaning: DirectionMeaning;
  relationType: RelationType;
  label: string;
  shortDescription: string;
  longDescription: string;
  relationSource: RelationSource;
  confidence: number;
  evidence: EdgeEvidence[];
  llmGenerated: boolean;
  userEdited: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EdgeSuggestion = {
  id: string;
  targetEdgeId?: string;
  source: string;
  target: string;
  suggestedRelationType: RelationType;
  suggestedLabel: string;
  suggestedShortDescription: string;
  suggestedLongDescription: string;
  reason: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export type AnalysisSettings = {
  semanticEdgeLimitPerPaper: number;
  candidateLimitPerNewPaper: number;
  minConfidenceForAutoEdge: number;
  minConfidenceForSuggestion: number;
};

export type GraphData = {
  version: string;
  projectId: string;
  updatedAt: string;
  nodes: PaperNode[];
  edges: PaperEdge[];
  edgeSuggestions: EdgeSuggestion[];
  analysisSettings: AnalysisSettings;
};

export type StoredFile = {
  id: string;
  filename: string;
  localFilePath?: string;
  size: number;
};

export interface StorageAdapter {
  readGraph(projectId: string): Promise<GraphData | null>;
  writeGraph(projectId: string, graph: GraphData): Promise<void>;
  savePdf(projectId: string, file: Buffer, filename: string): Promise<StoredFile>;
  readPdf(projectId: string, fileId: string): Promise<Buffer>;
}

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  semanticEdgeLimitPerPaper: 5,
  candidateLimitPerNewPaper: 8,
  minConfidenceForAutoEdge: 0.68,
  minConfidenceForSuggestion: 0.45
};

export const RELATION_LABELS: Record<RelationType, string> = {
  extends: "후속/확장",
  prerequisite: "선행 연구",
  supports: "뒷받침",
  contradicts: "반박",
  applies: "응용",
  uses_method: "방법 사용",
  compares_with: "비교",
  conceptually_related: "개념 연관",
  background: "배경 지식",
  unknown: "미분류"
};

export const EDGE_STYLE_MAP: Record<
  RelationType,
  { stroke: string; strokeWidth: number; strokeDasharray: string }
> = {
  extends: { stroke: "#111111", strokeWidth: 2.4, strokeDasharray: "none" },
  prerequisite: { stroke: "#111111", strokeWidth: 2, strokeDasharray: "none" },
  supports: { stroke: "#222222", strokeWidth: 2, strokeDasharray: "none" },
  contradicts: { stroke: "#111111", strokeWidth: 2.2, strokeDasharray: "6 4" },
  applies: { stroke: "#444444", strokeWidth: 2, strokeDasharray: "none" },
  uses_method: { stroke: "#555555", strokeWidth: 1.8, strokeDasharray: "none" },
  compares_with: { stroke: "#666666", strokeWidth: 1.6, strokeDasharray: "4 4" },
  conceptually_related: { stroke: "#999999", strokeWidth: 1.4, strokeDasharray: "none" },
  background: { stroke: "#BBBBBB", strokeWidth: 1.2, strokeDasharray: "3 4" },
  unknown: { stroke: "#CCCCCC", strokeWidth: 1, strokeDasharray: "2 4" }
};

export const RELATION_TYPES = Object.keys(RELATION_LABELS) as RelationType[];

export function createEmptyGraph(projectId: string): GraphData {
  return {
    version: "1.0",
    projectId,
    updatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    edgeSuggestions: [],
    analysisSettings: DEFAULT_ANALYSIS_SETTINGS
  };
}
