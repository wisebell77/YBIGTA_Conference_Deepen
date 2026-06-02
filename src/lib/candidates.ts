import type { AnalysisSettings, PaperEdge, PaperNode } from "./types";

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
  "research",
  "논문",
  "연구",
  "분석",
  "방법",
  "결과"
]);

function tokenize(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .normalize("NFKC")
    .match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu);

  return new Set(
    (tokens ?? [])
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOPWORDS.has(token))
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

export function scoreCandidate(
  newPaper: PaperNode,
  oldPaper: PaperNode,
  settings: Pick<
    AnalysisSettings,
    "candidateTitleWeight" | "candidateKeywordWeight" | "candidateSummaryWeight"
  >
): number {
  const titleScore = keywordOverlap(newPaper.title, oldPaper.title);
  const keywordScore = arrayOverlap(newPaper.keywords, oldPaper.keywords);
  const summaryScore = keywordOverlap(newPaper.summary, oldPaper.summary);
  const totalWeight =
    settings.candidateTitleWeight +
    settings.candidateKeywordWeight +
    settings.candidateSummaryWeight;
  if (totalWeight <= 0) return 0;
  return (
    (settings.candidateTitleWeight * titleScore +
      settings.candidateKeywordWeight * keywordScore +
      settings.candidateSummaryWeight * summaryScore) /
    totalWeight
  );
}

export function selectCandidatePapers(params: {
  newPaper: PaperNode;
  existingNodes: PaperNode[];
  existingEdges: PaperEdge[];
  settings: AnalysisSettings;
}): PaperNode[] {
  const { newPaper, existingNodes, settings } = params;
  return existingNodes
    .filter((paper) => paper.id !== newPaper.id)
    .map((paper) => ({ paper, score: scoreCandidate(newPaper, paper, settings) }))
    .filter(
      ({ score }) => settings.includeZeroScoreCandidates || score >= settings.candidateMinScore
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(b.paper.updatedAt) - Date.parse(a.paper.updatedAt);
    })
    .slice(0, settings.candidateLimitPerNewPaper)
    .map(({ paper }) => paper);
}
