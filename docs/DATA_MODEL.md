# Data Model

The canonical graph file is:

```text
local_data/projects/:projectId/cache/graph.json
```

In Google Drive mode, the same logical file lives in the Drive project cache.

## GraphData

```ts
type GraphData = {
  version: string;
  projectId: string;
  updatedAt: string;
  nodes: PaperNode[];
  edges: PaperEdge[];
  edgeSuggestions: EdgeSuggestion[];
  analysisSettings: AnalysisSettings;
  uiSettings?: GraphUiSettings;
};
```

## PaperNode

```ts
type PaperNode = {
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
  webViewLink?: string;
  localFilePath?: string;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
};
```

Rules:

- Node type is always `paper`.
- No concept/method/dataset nodes in MVP.
- `summary`, `shortSummary`, `keywords`, and `embeddingText` are graph memory, not just UI copy.
- `localFileId` is used by the local PDF route.
- `driveFileId` and `webViewLink` are for Google Drive mode.

## PaperEdge

```ts
type PaperEdge = {
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
```

Rules:

- Edge source and target must be paper ids.
- Default direction means knowledge flow.
- If direction is unclear, use `directed=false`.
- `source`, `target`, and `id` are immutable through the edit API.
- User edits set `userEdited=true` and `relationSource=user_edited`.
- User-created edges use `relationSource=user_created`.

## RelationType

```ts
type RelationType =
  | "extends"
  | "prerequisite"
  | "supports"
  | "contradicts"
  | "applies"
  | "uses_method"
  | "compares_with"
  | "conceptually_related"
  | "background"
  | "custom"
  | "unknown";
```

`custom` was added so users can create relationships that do not fit the LLM-defined categories.

## EdgeSuggestion

```ts
type EdgeSuggestion = {
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
```

Suggestions are used when LLM output should not directly overwrite existing graph memory.

## AnalysisSettings

```ts
type AnalysisSettings = {
  semanticEdgeLimitPerPaper: number;
  candidateLimitPerNewPaper: number;
  candidateTitleWeight: number;
  candidateKeywordWeight: number;
  candidateSummaryWeight: number;
  candidateMinScore: number;
  includeZeroScoreCandidates: boolean;
  minConfidenceForAutoEdge: number;
  minConfidenceForSuggestion: number;
  customEdgePrompt: string;
};
```

Defaults:

```ts
{
  semanticEdgeLimitPerPaper: 5,
  candidateLimitPerNewPaper: 8,
  candidateTitleWeight: 2,
  candidateKeywordWeight: 3,
  candidateSummaryWeight: 1,
  candidateMinScore: 0.05,
  includeZeroScoreCandidates: true,
  minConfidenceForAutoEdge: 0.72,
  minConfidenceForSuggestion: 0.45,
  customEdgePrompt: ""
}
```

These settings are project policy for future uploads by default. Updating them
should not rewrite existing nodes, edges, or suggestions unless the user explicitly
runs Refresh Edges, which recomputes generated edges from the current settings.

## GraphUiSettings

```ts
type GraphUiSettings = {
  edgeColors?: Partial<Record<RelationType, string>>;
  edgeLineStyles?: Partial<Record<RelationType, "solid" | "dashed" | "dotted">>;
  nodeShapeMode?: "square" | "circle";
  showEdgeLabels?: boolean;
  freeMoveMode?: boolean;
  nodePositions?: Record<string, { x: number; y: number }>;
};
```

UI settings are persisted with the graph so a reopened project keeps relation color choices.

Fields:

- `edgeColors`: relation color overrides.
- `edgeLineStyles`: relation line style overrides.
- `nodeShapeMode`: square or circle node rendering.
- `showEdgeLabels`: whether compact edge label pills are visible.
- `freeMoveMode`: whether nodes can be dragged on the canvas.
- `nodePositions`: persisted React Flow node coordinates saved after drag stop.

## Merge Invariants

The merge logic must preserve graph memory.

Rules:

- Existing nodes remain.
- New paper is added only if its id is not already present.
- Existing edges remain.
- `userEdited=true` edges are never overwritten.
- Same source/target/relationType edge is a duplicate.
- Same source/target with different relationType becomes a suggestion.
- Low confidence output is discarded.
- Mid confidence output becomes a suggestion.
- High confidence output becomes an edge.
- `updatedAt` is refreshed after merge.

For undirected edges, reversed source/target should be treated as the same pair.


## Refresh Invariants

Manual generated-edge refresh uses the same `GraphData` shape but a different mutation path:

- User-controlled edges are preserved if `userEdited=true` or `relationSource` is `user_created` / `user_edited`.
- Generated edges are removed before recomputation.
- Existing suggestions are cleared and regenerated from the current policy.
- Paper nodes and original PDFs are not re-parsed or rewritten.
- Relation extraction is replayed over existing paper metadata in creation order.
## Deletion Rules

Edge deletion removes only the edge and suggestions that target that edge.

Paper node deletion removes:

- the paper node
- every edge connected to that paper
- every suggestion whose source or target is that paper
- the saved node position for that paper

Paper node deletion intentionally does not delete the original PDF file from
local storage or Google Drive.
