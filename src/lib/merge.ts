import type { EdgeSuggestion, GraphData, PaperEdge, PaperNode } from "./types";
import type { DirectionMeaning, RelationType } from "./types";

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

export function createUserEdge(
  graph: GraphData,
  input: {
    source: string;
    target: string;
    directed: boolean;
    directionMeaning?: DirectionMeaning;
    relationType: RelationType;
    label: string;
    shortDescription: string;
    longDescription: string;
  }
): { graph: GraphData; edge: PaperEdge } {
  const timestamp = now();
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(input.source) || !nodeIds.has(input.target)) {
    throw new Error("INVALID_EDGE_ENDPOINT");
  }
  if (input.source === input.target) {
    throw new Error("SELF_EDGE_NOT_ALLOWED");
  }

  const edge: PaperEdge = {
    id: `edge_${crypto.randomUUID()}`,
    source: input.source,
    target: input.target,
    directed: input.directed,
    directionMeaning:
      input.directionMeaning ??
      (input.directed ? "knowledge_flow" : "undirected_conceptual_similarity"),
    relationType: input.relationType,
    label: input.label,
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    relationSource: "user_created",
    confidence: 1,
    evidence: [
      {
        paperId: input.source,
        type: "llm_reasoning",
        text: "User-created relationship."
      },
      {
        paperId: input.target,
        type: "llm_reasoning",
        text: "User-created relationship."
      }
    ],
    llmGenerated: false,
    userEdited: true,
    locked: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    graph: {
      ...graph,
      edges: [...graph.edges, edge],
      updatedAt: timestamp
    },
    edge
  };
}

export function deleteEdge(graph: GraphData, edgeId: string): GraphData {
  const edgeExists = graph.edges.some((edge) => edge.id === edgeId);
  if (!edgeExists) throw new Error("EDGE_NOT_FOUND");

  return {
    ...graph,
    edges: graph.edges.filter((edge) => edge.id !== edgeId),
    edgeSuggestions: graph.edgeSuggestions.filter((suggestion) => suggestion.targetEdgeId !== edgeId),
    updatedAt: now()
  };
}

export function deletePaperNode(graph: GraphData, paperId: string): GraphData {
  const nodeExists = graph.nodes.some((node) => node.id === paperId);
  if (!nodeExists) throw new Error("PAPER_NOT_FOUND");

  const nodePositions = { ...(graph.uiSettings?.nodePositions ?? {}) };
  delete nodePositions[paperId];

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => node.id !== paperId),
    edges: graph.edges.filter((edge) => edge.source !== paperId && edge.target !== paperId),
    edgeSuggestions: graph.edgeSuggestions.filter(
      (suggestion) => suggestion.source !== paperId && suggestion.target !== paperId
    ),
    uiSettings: graph.uiSettings
      ? {
          ...graph.uiSettings,
          nodePositions
        }
      : graph.uiSettings,
    updatedAt: now()
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
