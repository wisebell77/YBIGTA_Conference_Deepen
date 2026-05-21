import type { EdgeSuggestion, GraphData, PaperEdge, PaperNode } from "./types";

function now(): string {
  return new Date().toISOString();
}

export function isSameUndirectedPair(
  a: Pick<PaperEdge, "source" | "target">,
  b: Pick<PaperEdge, "source" | "target">
): boolean {
  return (
    (a.source === b.source && a.target === b.target) ||
    (a.source === b.target && a.target === b.source)
  );
}

export function isSameEdge(
  a: Pick<PaperEdge, "source" | "target" | "relationType" | "directed">,
  b: Pick<PaperEdge, "source" | "target" | "relationType" | "directed">
): boolean {
  if (a.relationType !== b.relationType) return false;
  if (!a.directed || !b.directed) return isSameUndirectedPair(a, b);
  return a.source === b.source && a.target === b.target;
}

function isSameSuggestion(a: EdgeSuggestion, b: EdgeSuggestion): boolean {
  return (
    a.source === b.source &&
    a.target === b.target &&
    a.suggestedRelationType === b.suggestedRelationType &&
    a.status === b.status
  );
}

function toSuggestion(
  edge: PaperEdge,
  targetEdgeId?: string,
  reason = "Stored as a suggestion because it conflicts with an existing edge."
): EdgeSuggestion {
  return {
    id: `suggestion_${crypto.randomUUID()}`,
    targetEdgeId,
    source: edge.source,
    target: edge.target,
    suggestedRelationType: edge.relationType,
    suggestedLabel: edge.label,
    suggestedShortDescription: edge.shortDescription,
    suggestedLongDescription: edge.longDescription,
    reason,
    confidence: edge.confidence,
    status: "pending",
    createdAt: now()
  };
}

function pushSuggestionOnce(suggestions: EdgeSuggestion[], suggestion: EdgeSuggestion): void {
  if (!suggestions.some((existing) => isSameSuggestion(existing, suggestion))) {
    suggestions.push(suggestion);
  }
}

export function mergeGraph(params: {
  oldGraph: GraphData;
  newPaper: PaperNode;
  newEdges: PaperEdge[];
  suggestions: EdgeSuggestion[];
}): GraphData {
  const timestamp = now();
  const settings = params.oldGraph.analysisSettings;
  const nodes = params.oldGraph.nodes.some((node) => node.id === params.newPaper.id)
    ? params.oldGraph.nodes
    : [...params.oldGraph.nodes, params.newPaper];
  const edges = [...params.oldGraph.edges];
  const edgeSuggestions = [...params.oldGraph.edgeSuggestions];

  for (const suggestion of params.suggestions) {
    if (suggestion.confidence >= settings.minConfidenceForSuggestion) {
      pushSuggestionOnce(edgeSuggestions, suggestion);
    }
  }

  for (const edge of params.newEdges) {
    if (edge.confidence < settings.minConfidenceForSuggestion) continue;

    const sameEdge = edges.find((existing) => isSameEdge(existing, edge));
    if (sameEdge) continue;

    const samePair = edges.find((existing) => isSameUndirectedPair(existing, edge));
    if (samePair) {
      pushSuggestionOnce(
        edgeSuggestions,
        toSuggestion(
          edge,
          samePair.id,
          samePair.userEdited
            ? "The LLM result conflicts with a user-edited edge, so the existing edge was preserved."
            : "The LLM result has a different relationType for an existing paper pair, so it was stored as a suggestion."
        )
      );
      continue;
    }

    if (edge.confidence >= settings.minConfidenceForAutoEdge) {
      edges.push(edge);
    } else {
      pushSuggestionOnce(
        edgeSuggestions,
        toSuggestion(edge, undefined, "Confidence is below the auto-edge threshold.")
      );
    }
  }

  return {
    ...params.oldGraph,
    nodes,
    edges,
    edgeSuggestions,
    updatedAt: timestamp
  };
}

export function applyEdgeUpdate(
  graph: GraphData,
  edgeId: string,
  update: Pick<PaperEdge, "relationType" | "label" | "shortDescription" | "longDescription">
): { graph: GraphData; edge: PaperEdge } {
  const timestamp = now();
  let updatedEdge: PaperEdge | null = null;
  const edges = graph.edges.map((edge) => {
    if (edge.id !== edgeId) return edge;
    updatedEdge = {
      ...edge,
      ...update,
      userEdited: true,
      relationSource: "user_edited",
      updatedAt: timestamp
    };
    return updatedEdge;
  });

  if (!updatedEdge) throw new Error("EDGE_NOT_FOUND");
  return {
    graph: { ...graph, edges, updatedAt: timestamp },
    edge: updatedEdge
  };
}

export function acceptSuggestion(graph: GraphData, suggestionId: string): GraphData {
  const timestamp = now();
  const suggestion = graph.edgeSuggestions.find((item) => item.id === suggestionId);
  if (!suggestion) throw new Error("SUGGESTION_NOT_FOUND");
  if (suggestion.status !== "pending") throw new Error("SUGGESTION_ALREADY_RESOLVED");

  let appliedToExisting = false;
  const edges = graph.edges.map((edge) => {
    if (suggestion.targetEdgeId && edge.id === suggestion.targetEdgeId) {
      appliedToExisting = true;
      return {
        ...edge,
        relationType: suggestion.suggestedRelationType,
        label: suggestion.suggestedLabel,
        shortDescription: suggestion.suggestedShortDescription,
        longDescription: suggestion.suggestedLongDescription,
        relationSource: "user_edited",
        userEdited: true,
        updatedAt: timestamp
      } satisfies PaperEdge;
    }
    return edge;
  });

  if (!appliedToExisting) {
    edges.push({
      id: `edge_${crypto.randomUUID()}`,
      source: suggestion.source,
      target: suggestion.target,
      directed: false,
      directionMeaning: "unknown",
      relationType: suggestion.suggestedRelationType,
      label: suggestion.suggestedLabel,
      shortDescription: suggestion.suggestedShortDescription,
      longDescription: suggestion.suggestedLongDescription,
      relationSource: "user_created",
      confidence: suggestion.confidence,
      evidence: [],
      llmGenerated: false,
      userEdited: true,
      locked: false,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  return {
    ...graph,
    edges,
    edgeSuggestions: graph.edgeSuggestions.map((item) =>
      item.id === suggestionId ? { ...item, status: "accepted" } : item
    ),
    updatedAt: timestamp
  };
}

export function rejectSuggestion(graph: GraphData, suggestionId: string): GraphData {
  const suggestion = graph.edgeSuggestions.find((item) => item.id === suggestionId);
  if (!suggestion) throw new Error("SUGGESTION_NOT_FOUND");
  if (suggestion.status !== "pending") throw new Error("SUGGESTION_ALREADY_RESOLVED");
  return {
    ...graph,
    edgeSuggestions: graph.edgeSuggestions.map((item) =>
      item.id === suggestionId ? { ...item, status: "rejected" } : item
    ),
    updatedAt: now()
  };
}
