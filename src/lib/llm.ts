import { normalizeRelationExtraction } from "./graph-validation";
import { RELATION_LABELS } from "./types";
import type { EdgeSuggestion, PaperEdge, PaperNode, StoredFile } from "./types";

type MetadataResult = {
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  summary: string;
  shortSummary: string;
  keywords: string[];
  embeddingText: string;
};

type RawRelationEdge = Omit<
  PaperEdge,
  "id" | "llmGenerated" | "userEdited" | "locked" | "createdAt" | "updatedAt"
>;

type RawSuggestion = Omit<EdgeSuggestion, "id" | "status" | "createdAt"> & {
  targetEdgeId?: string | null;
};

export type RelationExtractionResult = {
  edges: RawRelationEdge[];
  suggestions: RawSuggestion[];
};

function extractJson<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error("LLM_JSON_PARSE_FAILED");
  }
}

type LlmProvider = "openai" | "upstage" | "gemini";

type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  chatCompletionsUrl: string;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = trimTrailingSlash(baseUrl);
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function llmConfig(): LlmConfig {
  const provider = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();

  if (provider === "upstage") {
    const apiKey = process.env.UPSTAGE_API_KEY;
    if (!apiKey) throw new Error("LLM_API_KEY_MISSING");
    return {
      provider: "upstage",
      apiKey,
      model: process.env.LLM_MODEL || "solar-pro3",
      chatCompletionsUrl: chatCompletionsUrl(
        process.env.UPSTAGE_BASE_URL ?? "https://api.upstage.ai/v1"
      )
    };
  }

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("LLM_API_KEY_MISSING");
    return {
      provider: "gemini",
      apiKey,
      model: process.env.LLM_MODEL || "gemini-2.5-flash",
      chatCompletionsUrl: chatCompletionsUrl(
        process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai"
      )
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY_MISSING");
  return {
    provider: "openai",
    apiKey,
    model: process.env.LLM_MODEL || "gpt-4.1-mini",
    chatCompletionsUrl: chatCompletionsUrl(
      process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
    )
  };
}

function shouldRetryWithoutResponseFormat(status: number, body: string): boolean {
  return (
    status >= 400 &&
    status < 500 &&
    /response_format|json_object|unsupported|invalid/i.test(body)
  );
}

async function callJsonLLM<T>(prompt: string, payload: unknown): Promise<T> {
  const config = llmConfig();

  const request = async (retry: boolean, includeResponseFormat: boolean): Promise<T> => {
    const response = await fetch(config.chatCompletionsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: retry ? `${prompt}\nReturn valid JSON only. No markdown.` : prompt
          },
          { role: "user", content: JSON.stringify(payload) }
        ],
        ...(includeResponseFormat ? { response_format: { type: "json_object" } } : {})
      })
    });

    if (!response.ok) {
      const body = await response.text();
      if (includeResponseFormat && shouldRetryWithoutResponseFormat(response.status, body)) {
        return request(retry, false);
      }
      throw new Error(`LLM_REQUEST_FAILED: ${body.slice(0, 500)}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM_EMPTY_RESPONSE");
    return extractJson<T>(content);
  };

  try {
    return await request(false, process.env.LLM_RESPONSE_FORMAT_JSON !== "false");
  } catch (error) {
    if ((error as Error).message.includes("LLM_JSON_PARSE_FAILED")) {
      return request(true, process.env.LLM_RESPONSE_FORMAT_JSON !== "false");
    }
    throw error;
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeMetadata(value: MetadataResult, originalFilename: string): MetadataResult {
  const title = asString(value.title, originalFilename.replace(/\.pdf$/i, ""));
  const authors = Array.isArray(value.authors)
    ? value.authors.map((author) => asString(author)).filter(Boolean).slice(0, 20)
    : [];
  const year = Number(value.year);
  const normalizedYear = Number.isInteger(year) && year >= 1500 && year <= 2200 ? year : null;
  const keywords = Array.isArray(value.keywords)
    ? value.keywords.map((keyword) => asString(keyword)).filter(Boolean).slice(0, 10)
    : [];
  const summary = asString(value.summary);

  return {
    title,
    authors,
    year: normalizedYear,
    abstract: asString(value.abstract),
    summary,
    shortSummary: asString(value.shortSummary, summary.slice(0, 220) || title),
    keywords,
    embeddingText: asString(
      value.embeddingText,
      [title, value.abstract, summary, keywords.join(", ")].filter(Boolean).join("\n")
    )
  };
}

function fallbackMetadata(rawText: string, originalFilename: string): MetadataResult {
  const sentences = rawText.match(/[^.!?]+[.!?]+/g)?.slice(0, 5).map((item) => item.trim()) ?? [];
  const title = originalFilename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
  const frequent = [...rawText.toLowerCase().matchAll(/[a-z][a-z-]{4,}/g)]
    .map((match) => match[0])
    .reduce<Record<string, number>>((acc, token) => {
      acc[token] = (acc[token] ?? 0) + 1;
      return acc;
    }, {});
  const keywords = Object.entries(frequent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
  const summary = sentences.join(" ") || rawText.slice(0, 700);
  return {
    title,
    authors: [],
    year: null,
    abstract: rawText.slice(0, 1200),
    summary,
    shortSummary: sentences[0] ?? title,
    keywords,
    embeddingText: [title, summary, keywords.join(", ")].join("\n")
  };
}

export async function extractPaperMetadataAndSummary(params: {
  rawText: string;
  originalFilename: string;
  storedFile: StoredFile;
}): Promise<MetadataResult> {
  const prompt = `You are an expert research assistant.

Given the raw text of a research paper, extract structured metadata and summarize it.

Return only valid JSON. Do not include markdown.

Required JSON schema:
{
  "title": string,
  "authors": string[],
  "year": number | null,
  "abstract": string,
  "summary": string,
  "shortSummary": string,
  "keywords": string[],
  "embeddingText": string
}

Rules:
- summary must be 3 to 5 sentences.
- shortSummary must be 1 sentence.
- keywords must contain 5 to 10 concise technical keywords.
- embeddingText should combine title, abstract, summary, and keywords into a compact searchable representation.
- If a field is uncertain, use null or an empty array.
- Do not invent authors or year if they are not present.`;

  try {
    const result = await callJsonLLM<MetadataResult>(prompt, {
      originalFilename: params.originalFilename,
      rawText: params.rawText.slice(0, 80000)
    });
    return normalizeMetadata(result, params.originalFilename);
  } catch (error) {
    if ((error as Error).message === "LLM_API_KEY_MISSING") {
      return fallbackMetadata(params.rawText, params.originalFilename);
    }
    throw error;
  }
}

export async function extractRelationsWithLLM(params: {
  newPaper: PaperNode;
  candidates: PaperNode[];
  existingEdges: PaperEdge[];
  edgeLimit: number;
  customEdgePrompt?: string;
}): Promise<RelationExtractionResult> {
  if (params.candidates.length === 0) return { edges: [], suggestions: [] };

  const prompt = `You are an expert research graph builder.

Your task is to identify meaningful relationships between a newly uploaded paper and candidate existing papers.

Return only valid JSON. Do not include markdown.

Use the following relation types only:
- extends
- prerequisite
- supports
- contradicts
- applies
- uses_method
- compares_with
- conceptually_related
- background
- unknown

Important rules:
1. The graph node is always a paper.
2. Create edges only between papers.
3. Direct citation is not required. If two papers are conceptually or methodologically related, you may create a semantic edge.
4. Do not create too many edges. Prefer the most meaningful relationships.
5. If direction is meaningful, use directed=true.
6. Direction should usually follow knowledge flow.
7. If direction is ambiguous, use directed=false.
8. Do not overwrite existing edges.
9. If your finding conflicts with an existing edge, put it in edgeSuggestions, not edges.
10. Be conservative. If confidence is too low, put it in suggestions or omit it.
11. Every edge or suggestion must connect the new paper to one candidate paper. Do not create candidate-to-candidate edges.

Output language:
- label and descriptions should be Korean.
- relationType must remain English enum.

Required JSON schema:
{
  "edges": [
    {
      "source": "paper id",
      "target": "paper id",
      "directed": boolean,
      "directionMeaning": "knowledge_flow" | "citation_direction" | "undirected_conceptual_similarity" | "unknown",
      "relationType": "extends" | "prerequisite" | "supports" | "contradicts" | "applies" | "uses_method" | "compares_with" | "conceptually_related" | "background" | "unknown",
      "label": "Korean label",
      "shortDescription": "Korean one sentence",
      "longDescription": "Korean explanation based on both paper summaries",
      "relationSource": "semantic_inference" | "citation_based",
      "confidence": number,
      "evidence": [{ "paperId": "paper id", "type": "abstract_similarity" | "method_similarity" | "keyword_overlap" | "llm_reasoning", "text": "short evidence" }]
    }
  ],
  "edgeSuggestions": []
}`;
  const finalPrompt = params.customEdgePrompt?.trim()
    ? `${prompt}\n\nProject-specific edge policy:\n${params.customEdgePrompt.trim()}`
    : prompt;

  try {
    const result = await callJsonLLM<{ edges: RawRelationEdge[]; edgeSuggestions: RawSuggestion[] }>(
      finalPrompt,
      {
        newPaper: params.newPaper,
        candidatePapers: params.candidates.map((paper) => ({
          id: paper.id,
          title: paper.title,
          summary: paper.summary,
          keywords: paper.keywords,
          knownEdges: params.existingEdges.filter(
            (edge) => edge.source === paper.id || edge.target === paper.id
          )
        })),
        existingEdges: params.existingEdges
      }
    );

    return normalizeRelationExtraction({
      rawEdges: result.edges,
      rawSuggestions: result.edgeSuggestions,
      newPaper: params.newPaper,
      candidates: params.candidates,
      existingEdges: params.existingEdges,
      edgeLimit: params.edgeLimit
    });
  } catch (error) {
    if ((error as Error).message === "LLM_API_KEY_MISSING") {
      return {
        edges: params.candidates.slice(0, params.edgeLimit).map((paper) => ({
          source:
            paper.year && params.newPaper.year && paper.year <= params.newPaper.year
              ? paper.id
              : params.newPaper.id,
          target:
            paper.year && params.newPaper.year && paper.year <= params.newPaper.year
              ? params.newPaper.id
              : paper.id,
          directed: false,
          directionMeaning: "undirected_conceptual_similarity",
          relationType: "conceptually_related",
          label: RELATION_LABELS.conceptually_related,
          shortDescription: "The papers are conceptually related by lexical similarity.",
          longDescription:
            "This relationship was generated by the local fallback because no LLM API key is configured. In production, the configured LLM evaluates conceptual and methodological relationships between the new paper and selected candidates.",
          relationSource: "semantic_inference",
          confidence: 0.7,
          evidence: [
            {
              paperId: paper.id,
              type: "keyword_overlap",
              text: `Overlapping keywords: ${paper.keywords
                .filter((keyword) => params.newPaper.keywords.includes(keyword))
                .slice(0, 5)
                .join(", ")}`
            }
          ]
        })),
        suggestions: []
      };
    }
    throw error;
  }
}
