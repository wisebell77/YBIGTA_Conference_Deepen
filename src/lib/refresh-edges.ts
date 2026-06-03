import { selectCandidatePapers } from "./candidates";
import { extractRelationsWithLLM } from "./llm";
import { mergeGraph } from "./merge";
import { readOrCreateGraph, storage } from "./storage";
import type { EdgeSuggestion, GraphData, PaperEdge, PaperNode } from "./types";

function isUserControlledEdge(edge: PaperEdge): boolean {
  return (
    edge.userEdited ||
    edge.relationSource === "user_created" ||
    edge.relationSource === "user_edited"
  );
}

function hydrateEdges(edges: Awaited<ReturnType<typeof extractRelationsWithLLM>>["edges"]): PaperEdge[] {
  const timestamp = new Date().toISOString();
  return edges.map((edge) => ({
    ...edge,
    id: `edge_${crypto.randomUUID()}`,
    llmGenerated: true,
    userEdited: false,
    locked: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
}

function hydrateSuggestions(
  suggestions: Awaited<ReturnType<typeof extractRelationsWithLLM>>["suggestions"]
): EdgeSuggestion[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    targetEdgeId: suggestion.targetEdgeId ?? undefined,
    id: `suggestion_${crypto.randomUUID()}`,
    status: "pending",
    createdAt: new Date().toISOString()
  }));
}

function sortByCreatedAt<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function refreshGeneratedEdges(projectId: string): Promise<{
  graph: GraphData;
  stats: {
    paperCount: number;
    preservedUserEdges: number;
    removedGeneratedEdges: number;
    generatedEdges: number;
    pendingSuggestions: number;
  };
}> {
  const graph = await readOrCreateGraph(projectId);
  const preservedEdges = graph.edges.filter(isUserControlledEdge);
  let refreshedGraph: GraphData = {
    ...graph,
    edges: preservedEdges,
    edgeSuggestions: [],
    updatedAt: new Date().toISOString()
  };

  const orderedPapers = sortByCreatedAt(graph.nodes);
  const processedPapers: PaperNode[] = [];

  for (const paper of orderedPapers) {
    const candidates = selectCandidatePapers({
      newPaper: paper,
      existingNodes: processedPapers,
      existingEdges: refreshedGraph.edges,
      settings: refreshedGraph.analysisSettings
    });
    processedPapers.push(paper);
    if (candidates.length === 0) continue;

    const relationResult = await extractRelationsWithLLM({
      newPaper: paper,
      candidates,
      existingEdges: refreshedGraph.edges,
      edgeLimit: refreshedGraph.analysisSettings.semanticEdgeLimitPerPaper,
      customEdgePrompt: refreshedGraph.analysisSettings.customEdgePrompt
    });

    refreshedGraph = mergeGraph({
      oldGraph: refreshedGraph,
      newPaper: paper,
      newEdges: hydrateEdges(relationResult.edges),
      suggestions: hydrateSuggestions(relationResult.suggestions)
    });
  }

  await storage.writeGraph(projectId, refreshedGraph);

  return {
    graph: refreshedGraph,
    stats: {
      paperCount: graph.nodes.length,
      preservedUserEdges: preservedEdges.length,
      removedGeneratedEdges: graph.edges.length - preservedEdges.length,
      generatedEdges: refreshedGraph.edges.length - preservedEdges.length,
      pendingSuggestions: refreshedGraph.edgeSuggestions.filter(
        (suggestion) => suggestion.status === "pending"
      ).length
    }
  };
}
