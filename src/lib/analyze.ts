import type { EdgeSuggestion, PaperEdge, PaperNode, PaperSummary, StoredFile } from "./types";
import { extractPaperMetadataAndSummary, extractRelationsWithLLM } from "./llm";
import { extractTextFromPdf } from "./pdf";
import { mergeGraph } from "./merge";
import { readOrCreateGraph, storage } from "./storage";
import { selectCandidatePapers } from "./candidates";

function createPaperNode(params: {
  paperId: string;
  metadata: Awaited<ReturnType<typeof extractPaperMetadataAndSummary>>;
  originalFilename: string;
  storedFile: StoredFile;
  summaryFile?: StoredFile;
}): PaperNode {
  const timestamp = new Date().toISOString();
  return {
    id: params.paperId,
    type: "paper",
    title: params.metadata.title || params.originalFilename.replace(/\.pdf$/i, ""),
    authors: params.metadata.authors ?? [],
    year: params.metadata.year ?? undefined,
    abstract: params.metadata.abstract || undefined,
    summary: params.metadata.summary || "",
    summaryFileId: params.summaryFile?.id,
    shortSummary: params.metadata.shortSummary || params.metadata.summary?.slice(0, 160) || "",
    keywords: params.metadata.keywords ?? [],
    embeddingText: params.metadata.embeddingText || params.metadata.summary || params.metadata.title,
    localFileId: params.storedFile.id,
    driveFileId: params.storedFile.driveFileId,
    webViewLink: params.storedFile.webViewLink,
    localFilePath: params.storedFile.localFilePath,
    originalFilename: params.originalFilename,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createPaperSummary(params: {
  paperId: string;
  projectId: string;
  metadata: Awaited<ReturnType<typeof extractPaperMetadataAndSummary>>;
  originalFilename: string;
  storedFile: StoredFile;
}): PaperSummary {
  const timestamp = new Date().toISOString();
  const summary = params.metadata.summary || "";
  return {
    schemaVersion: "1.0",
    paperId: params.paperId,
    projectId: params.projectId,
    title: params.metadata.title || params.originalFilename.replace(/\.pdf$/i, ""),
    authors: params.metadata.authors ?? [],
    year: params.metadata.year ?? undefined,
    abstract: params.metadata.abstract || undefined,
    summary,
    shortSummary: params.metadata.shortSummary || summary.slice(0, 160) || "",
    keywords: params.metadata.keywords ?? [],
    embeddingText: params.metadata.embeddingText || summary || params.metadata.title,
    originalFilename: params.originalFilename,
    pdfFileId: params.storedFile.id,
    driveFileId: params.storedFile.driveFileId,
    webViewLink: params.storedFile.webViewLink,
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
  const paperId = `paper_${crypto.randomUUID()}`;
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
  const paperSummary = createPaperSummary({
    paperId,
    projectId: params.projectId,
    metadata,
    originalFilename: params.originalFilename,
    storedFile
  });
  const summaryFile = storage.writePaperSummary
    ? await storage.writePaperSummary(params.projectId, paperSummary)
    : undefined;
  const newPaper = createPaperNode({
    paperId,
    metadata,
    originalFilename: params.originalFilename,
    storedFile,
    summaryFile
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
