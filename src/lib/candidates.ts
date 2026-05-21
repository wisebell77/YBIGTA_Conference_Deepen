import type { PaperEdge, PaperNode } from "./types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "was",
  "were",
  "paper",
  "study",
  "using",
  "through",
  "based",
  "analysis",
  "research"
]);

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );
}

function keywordOverlap(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / Math.max(left.size, right.size);
}

function arrayOverlap(a: string[], b: string[]): number {
  const left = tokenize(a.join(" "));
  const right = tokenize(b.join(" "));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / Math.max(left.size, right.size);
}

export function scoreCandidate(newPaper: PaperNode, oldPaper: PaperNode): number {
  const titleScore = keywordOverlap(newPaper.title, oldPaper.title);
  const keywordScore = arrayOverlap(newPaper.keywords, oldPaper.keywords);
  const summaryScore = keywordOverlap(newPaper.summary, oldPaper.summary);
  return 0.2 * titleScore + 0.5 * keywordScore + 0.3 * summaryScore;
}

export function selectCandidatePapers(params: {
  newPaper: PaperNode;
  existingNodes: PaperNode[];
  existingEdges: PaperEdge[];
  limit: number;
}): PaperNode[] {
  const { newPaper, existingNodes, limit } = params;
  return existingNodes
    .filter((paper) => paper.id !== newPaper.id)
    .map((paper) => ({ paper, score: scoreCandidate(newPaper, paper) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ paper }) => paper);
}
