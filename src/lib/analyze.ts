import type { EdgeSuggestion, PaperEdge, PaperNode } from "./types";
import { extractPaperMetadataAndSummary, extractRelationsWithLLM } from "./llm";
import { extractTextFromPdf } from "./pdf";
import { mergeGraph } from "./merge";
import { readOrCreateGraph, storage } from "./storage";
import { selectCandidatePapers } from "./candidates";

function createPaperNode(params: {
  metadata: Awaited<ReturnType<typeof extractPaperMetadataAndSummary>>;
  originalFilename: string;
  storedFile: Awaited<ReturnType<typeof storage.savePdf>>;
}): PaperNode {
  const timestamp = new Date().toISOString();
  return {
    id: `paper_${crypto.randomUUID()}`,
    type: "paper",
    title: params.metadata.title || params.originalFilename.replace(/\.pdf$/i, ""),
    authors: params.metadata.authors ?? [],
    year: params.metadata.year ?? undefined,
    abstract: params.metadata.abstract || undefined,
    summary: params.metadata.summary || "",
    shortSummary: params.metadata.shortSummary || params.metadata.summary?.slice(0, 160) || "",
    keywords: params.metadata.keywords ?? [],
    embeddingText: params.metadata.embeddingText || params.metadata.summary || params.metadata.title,
    localFileId: params.storedFile.id,
    localFilePath: params.storedFile.localFilePath,
    originalFilename: params.originalFilename,
    createdAt: timestamp,
    updatedAt: timestamp
  };
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

export async function analyzeUploadedPaper(params: {
  projectId: string;
  pdfBuffer: Buffer;
  originalFilename: string;
}) {
  const storedFile = await storage.savePdf(
    params.projectId,
    params.pdfBuffer,
    params.originalFilename
  );
  const rawText = await extractTextFromPdf(params.pdfBuffer);
  const metadata = await extractPaperMetadataAndSummary({
    rawText,
    originalFilename: params.originalFilename,
    storedFile
  });
  const newPaper = createPaperNode({
    metadata,
    originalFilename: params.originalFilename,
    storedFile
  });
  const graph = await readOrCreateGraph(params.projectId);
  const candidates = selectCandidatePapers({
    newPaper,
    existingNodes: graph.nodes,
    existingEdges: graph.edges,
    limit: graph.analysisSettings.candidateLimitPerNewPaper
  });
  const relationResult = await extractRelationsWithLLM({
    newPaper,
    candidates,
    existingEdges: graph.edges,
    edgeLimit: graph.analysisSettings.semanticEdgeLimitPerPaper
  });
  const mergedGraph = mergeGraph({
    oldGraph: graph,
    newPaper,
    newEdges: hydrateEdges(relationResult.edges),
    suggestions: hydrateSuggestions(relationResult.suggestions)
  });

  await storage.writeGraph(params.projectId, mergedGraph);
  return { graph: mergedGraph, paperId: newPaper.id };
}
