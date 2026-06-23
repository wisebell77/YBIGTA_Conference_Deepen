import { callJsonLLM } from "./llm";
import {
  RELATION_LABELS,
  type ChatProposedAction,
  type GraphChatMessage,
  type GraphChatResult,
  type GraphData,
  type PaperEdge,
  type RelationType
} from "./types";

type RawChatAction = {
  type?: string;
  reason?: string;
  edgeId?: string;
  patch?: {
    relationType?: RelationType;
    label?: string;
    shortDescription?: string;
    longDescription?: string;
  };
  input?: {
    source?: string;
    target?: string;
    directed?: boolean;
    relationType?: RelationType;
    label?: string;
    shortDescription?: string;
    longDescription?: string;
  };
};

type RawChatResult = {
  answer?: string;
  proposedActions?: RawChatAction[];
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeRelationType(value: unknown): RelationType {
  const candidate = asString(value);
  return candidate in RELATION_LABELS ? (candidate as RelationType) : "custom";
}

function actionId(): string {
  return `chat_action_${crypto.randomUUID()}`;
}

function findEdge(graph: GraphData, edgeId: string): PaperEdge | undefined {
  return graph.edges.find((edge) => edge.id === edgeId);
}

function graphContext(graph: GraphData) {
  return {
    projectId: graph.projectId,
    papers: graph.nodes.map((paper) => ({
      id: paper.id,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      abstract: paper.abstract,
      summary: paper.summary,
      shortSummary: paper.shortSummary,
      keywords: paper.keywords,
      embeddingText: paper.embeddingText,
      originalFilename: paper.originalFilename
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      directed: edge.directed,
      directionMeaning: edge.directionMeaning,
      relationType: edge.relationType,
      label: edge.label,
      shortDescription: edge.shortDescription,
      longDescription: edge.longDescription,
      relationSource: edge.relationSource,
      confidence: edge.confidence,
      evidence: edge.evidence,
      userEdited: edge.userEdited
    })),
    pendingSuggestions: graph.edgeSuggestions
      .filter((suggestion) => suggestion.status === "pending")
      .map((suggestion) => ({
        id: suggestion.id,
        targetEdgeId: suggestion.targetEdgeId,
        source: suggestion.source,
        target: suggestion.target,
        suggestedRelationType: suggestion.suggestedRelationType,
        suggestedLabel: suggestion.suggestedLabel,
        reason: suggestion.reason,
        confidence: suggestion.confidence
      }))
  };
}

function normalizeActions(graph: GraphData, rawActions: unknown): ChatProposedAction[] {
  if (!Array.isArray(rawActions)) return [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const actions: ChatProposedAction[] = [];

  for (const item of rawActions.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const raw = item as RawChatAction;
    const reason = asString(raw.reason, "챗봇이 그래프 수정 후보를 제안했습니다.");

    if (raw.type === "update_edge") {
      const edgeId = asString(raw.edgeId);
      const edge = findEdge(graph, edgeId);
      if (!edge || !raw.patch) continue;
      const relationType = normalizeRelationType(raw.patch.relationType ?? edge.relationType);
      actions.push({
        id: actionId(),
        type: "update_edge",
        reason,
        edgeId,
        patch: {
          relationType,
          label: asString(raw.patch.label, edge.label || RELATION_LABELS[relationType]),
          shortDescription: asString(raw.patch.shortDescription, edge.shortDescription),
          longDescription: asString(raw.patch.longDescription, edge.longDescription)
        }
      });
      continue;
    }

    if (raw.type === "create_edge" && raw.input) {
      const source = asString(raw.input.source);
      const target = asString(raw.input.target);
      if (!nodeIds.has(source) || !nodeIds.has(target) || source === target) continue;
      const relationType = normalizeRelationType(raw.input.relationType ?? "custom");
      actions.push({
        id: actionId(),
        type: "create_edge",
        reason,
        input: {
          source,
          target,
          directed: typeof raw.input.directed === "boolean" ? raw.input.directed : true,
          relationType,
          label: asString(raw.input.label, RELATION_LABELS[relationType]),
          shortDescription: asString(
            raw.input.shortDescription,
            "챗봇이 제안한 사용자 승인 기반 관계입니다."
          ),
          longDescription: asString(
            raw.input.longDescription,
            "챗봇이 현재 그래프 맥락을 참고해 제안한 관계입니다. 사용자가 적용을 승인한 뒤 저장됩니다."
          )
        }
      });
    }
  }

  return actions;
}

export async function chatWithGraph(params: {
  graph: GraphData;
  messages: GraphChatMessage[];
}): Promise<GraphChatResult> {
  const prompt = `You are Deepen's graph-aware research assistant.

You answer questions about the user's paper graph memory.
You can read the graph context, paper summaries, keywords, relation edges, evidence, and pending suggestions.
Use English paper summaries and graph relations as your primary reasoning source.
Answer in Korean unless the user explicitly asks for another language.

Important safety rules:
- Do not claim that you changed the graph.
- You are not allowed to directly mutate graph.json.
- If the user asks to modify, create, or improve a relationship, return a proposed action for user approval.
- Proposed actions are suggestions only. The UI will show an Apply button, and the user must approve before any API mutation happens.
- Only propose update_edge or create_edge actions.
- Do not propose paper deletion.
- Be conservative. If the graph does not contain enough evidence, say so.

Return only valid JSON. Do not include markdown.

Required JSON schema:
{
  "answer": "Korean answer shown to the user",
  "proposedActions": [
    {
      "type": "update_edge",
      "reason": "Korean reason",
      "edgeId": "existing edge id",
      "patch": {
        "relationType": "one allowed relation type",
        "label": "Korean label",
        "shortDescription": "Korean short description",
        "longDescription": "Korean detailed description"
      }
    },
    {
      "type": "create_edge",
      "reason": "Korean reason",
      "input": {
        "source": "paper id",
        "target": "paper id",
        "directed": true,
        "relationType": "custom",
        "label": "Korean label",
        "shortDescription": "Korean short description",
        "longDescription": "Korean detailed description"
      }
    }
  ]
}`;

  const result = await callJsonLLM<RawChatResult>(prompt, {
    graph: graphContext(params.graph),
    messages: params.messages.slice(-12)
  });

  return {
    answer: asString(result.answer, "현재 그래프를 기준으로 답변을 만들 수 없습니다."),
    proposedActions: normalizeActions(params.graph, result.proposedActions)
  };
}
