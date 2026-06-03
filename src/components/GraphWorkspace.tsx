"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  type Connection,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeTypes
} from "reactflow";
import PaperNode from "./PaperNode";
import {
  EDGE_STYLE_MAP,
  RELATION_LABELS,
  RELATION_TYPES,
  DEFAULT_ANALYSIS_SETTINGS,
  type AnalysisSettings,
  type EdgeSuggestion,
  type EdgeLineStyle,
  type GraphUiSettings,
  type GraphData,
  type PaperEdge,
  type PaperNode as PaperNodeType,
  type RelationType
} from "@/lib/types";

type SelectedItem =
  | { kind: "paper"; paper: PaperNodeType }
  | { kind: "edge"; edge: PaperEdge }
  | { kind: "createEdge" }
  | null;

type EdgeForm = {
  relationType: RelationType;
  label: string;
  shortDescription: string;
  longDescription: string;
};

type CreateEdgeForm = EdgeForm & {
  source: string;
  target: string;
  directed: boolean;
};

type AnalysisSettingsForm = {
  semanticEdgeLimitPerPaper: string;
  candidateLimitPerNewPaper: string;
  minConfidenceForAutoEdge: string;
  minConfidenceForSuggestion: string;
  candidateTitleWeight: string;
  candidateKeywordWeight: string;
  candidateSummaryWeight: string;
  candidateMinScore: string;
  includeZeroScoreCandidates: boolean;
  customEdgePrompt: string;
};

type GoogleAuthStatus = {
  connected: boolean;
  user: { email: string; name?: string | null } | null;
};

type DriveUploadResult = {
  id?: string;
  name?: string;
  size?: string;
  webViewLink?: string;
};

type DriveChunkResponse = {
  success: boolean;
  done?: boolean;
  file?: DriveUploadResult;
  error?: string;
};

type NodeShapeMode = "square" | "circle";

type PaperEdgeData = {
  edge: PaperEdge;
  sourceTitle: string;
  targetTitle: string;
  stroke: string;
  showLabel: boolean;
  curveOffset: number;
};

const nodeTypes: NodeTypes = { paperNode: PaperNode };
const edgeTypes: EdgeTypes = { paperEdge: PaperRelationEdge };
const DRIVE_UPLOAD_CHUNK_SIZE = 3 * 1024 * 1024;
const LARGE_PDF_ANALYSIS_MB = 4.5;

type RelationColorMap = Record<RelationType, string>;
type RelationLineStyleMap = Record<RelationType, EdgeLineStyle>;

const DEFAULT_RELATION_EDGE_COLORS: RelationColorMap = {
  extends: "#111827",
  prerequisite: "#374151",
  supports: "#14532d",
  contradicts: "#7f1d1d",
  applies: "#1f2937",
  uses_method: "#164e63",
  compares_with: "#57534e",
  conceptually_related: "#71717a",
  background: "#a1a1aa",
  custom: "#312e81",
  unknown: "#d4d4d8"
};

const DEFAULT_RELATION_EDGE_LINE_STYLES: RelationLineStyleMap = {
  extends: "solid",
  prerequisite: "solid",
  supports: "solid",
  contradicts: "dashed",
  applies: "solid",
  uses_method: "solid",
  compares_with: "dashed",
  conceptually_related: "solid",
  background: "dashed",
  custom: "dashed",
  unknown: "dotted"
};

const EDGE_LINE_STYLE_OPTIONS: { value: EdgeLineStyle; label: string; dasharray: string }[] = [
  { value: "solid", label: "실선", dasharray: "none" },
  { value: "dashed", label: "점선", dasharray: "6 4" },
  { value: "dotted", label: "도트", dasharray: "2 5" }
];

function edgeLineDasharray(lineStyle: EdgeLineStyle) {
  return EDGE_LINE_STYLE_OPTIONS.find((option) => option.value === lineStyle)?.dasharray ?? "none";
}

function panelFontSize(width: number) {
  return `${Math.max(13, Math.min(18, Math.round(width / 22)))}px`;
}

function confidenceStyle(
  edge: PaperEdge,
  relationColors: RelationColorMap,
  relationLineStyles: RelationLineStyleMap
) {
  const base = EDGE_STYLE_MAP[edge.relationType];
  const confidence = Math.max(0.1, Math.min(1, edge.confidence));
  return {
    ...base,
    stroke: relationColors[edge.relationType],
    strokeDasharray: edgeLineDasharray(relationLineStyles[edge.relationType]),
    strokeWidth: Math.max(1.4, base.strokeWidth + confidence * 0.9),
    opacity: Math.max(0.42, 0.24 + confidence * 0.7)
  };
}

function edgePairKey(edge: Pick<PaperEdge, "source" | "target" | "directed">) {
  return edge.directed
    ? `${edge.source}->${edge.target}`
    : [edge.source, edge.target].sort().join("--");
}

function toReactFlowNodes(
  graph: GraphData,
  visibleNodeIds: Set<string>,
  shapeMode: NodeShapeMode
): Node[] {
  const savedPositions = graph.uiSettings?.nodePositions ?? {};
  return graph.nodes
    .filter((paper) => visibleNodeIds.has(paper.id))
    .map((paper, index) => ({
      id: paper.id,
      type: "paperNode",
      position: savedPositions[paper.id] ?? {
        x: (index % 5) * (shapeMode === "circle" ? 210 : 310),
        y: Math.floor(index / 5) * (shapeMode === "circle" ? 160 : 190)
      },
      data: {
        title: paper.title,
        shortSummary: paper.shortSummary,
        paper,
        shapeMode
      }
    }));
}

function toReactFlowEdges(
  graph: GraphData,
  activeRelations: Set<RelationType>,
  relationColors: RelationColorMap,
  relationLineStyles: RelationLineStyleMap,
  showEdgeLabels: boolean
): Edge[] {
  const filteredEdges = graph.edges.filter(
    (edge) => activeRelations.size === 0 || activeRelations.has(edge.relationType)
  );
  const pairCounts = new Map<string, number>();
  filteredEdges.forEach((edge) => {
    const key = edgePairKey(edge);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  });
  const pairSeen = new Map<string, number>();

  return filteredEdges.map((edge, index) => {
    const key = edgePairKey(edge);
    const seen = pairSeen.get(key) ?? 0;
    pairSeen.set(key, seen + 1);
    const pairCount = pairCounts.get(key) ?? 1;
    const middle = (pairCount - 1) / 2;
    const parallelOffset = (seen - middle) * 0.22;
    const alternatingOffset = ((index % 5) - 2) * 0.035;
    const curveOffset = parallelOffset + alternatingOffset;

    return {
      id: edge.id,
      type: "paperEdge",
      source: edge.source,
      target: edge.target,
      animated: false,
      style: {
        ...confidenceStyle(edge, relationColors, relationLineStyles),
        zIndex: 20
      },
      interactionWidth: 28,
      data: {
        edge,
        sourceTitle: getPaperTitle(graph, edge.source),
        targetTitle: getPaperTitle(graph, edge.target),
        stroke: relationColors[edge.relationType],
        showLabel: showEdgeLabels,
        curveOffset
      } satisfies PaperEdgeData
    };
  });
}

function PaperRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data
}: EdgeProps<PaperEdgeData>) {
  const edge = data?.edge;
  if (!edge) return null;

  const stroke = data?.stroke ?? DEFAULT_RELATION_EDGE_COLORS[edge.relationType];
  const markerId = `edge-arrow-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const curveOffset = data?.curveOffset ?? 0;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.max(1, Math.hypot(dx, dy));
  let normalX = -dy / length;
  let normalY = dx / length;
  if (normalY > 0) {
    normalX *= -1;
    normalY *= -1;
  }
  const labelDirection = curveOffset < 0 ? -1 : 1;
  const bend = 44 + Math.min(110, Math.abs(curveOffset) * 260);
  const controlX = (sourceX + targetX) / 2 + normalX * bend * labelDirection;
  const controlY = (sourceY + targetY) / 2 + normalY * bend * labelDirection;
  const edgePath = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`;
  const labelX = 0.25 * sourceX + 0.5 * controlX + 0.25 * targetX;
  const labelY = 0.25 * sourceY + 0.5 * controlY + 0.25 * targetY;
  const labelOffset = 28;
  const labelPosX = labelX + normalX * labelOffset * labelDirection;
  const labelPosY = labelY + normalY * labelOffset * labelDirection - 12;

  return (
    <>
      {edge.directed && (
        <defs>
          <marker
            id={markerId}
            markerWidth="7"
            markerHeight="7"
            refX="6.2"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 7 3.5 L 0 7 z" fill={stroke} />
          </marker>
        </defs>
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={edge.directed ? `url(#${markerId})` : undefined}
        style={{
          ...style,
          stroke,
          filter: edge.confidence >= 0.75 ? "drop-shadow(0 1px 1px rgba(0,0,0,0.12))" : undefined
        }}
      />
      {data?.showLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-full"
            style={{
              transform: `translate(${labelPosX}px, ${labelPosY}px) translate(-50%, -100%)`
            }}
            title={displayEdgeDescription(edge, null)}
          >
            <div
              className="edge-label-pill"
              style={{
                borderColor: `${stroke}55`,
                color: stroke
              }}
            >
              {displayEdgeLabel(edge)}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function formatAuthors(authors: string[]) {
  return authors.length ? authors.join(", ") : "Unknown authors";
}

function normalizeDuplicateKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPotentialDuplicate(graph: GraphData | null, file: File): PaperNodeType | null {
  if (!graph) return null;
  const fileKey = normalizeDuplicateKey(file.name);
  if (!fileKey) return null;

  return (
    graph.nodes.find((paper) => normalizeDuplicateKey(paper.originalFilename) === fileKey) ??
    graph.nodes.find((paper) => normalizeDuplicateKey(paper.title) === fileKey) ??
    null
  );
}

function getPaperTitle(graph: GraphData | null, paperId: string) {
  return graph?.nodes.find((paper) => paper.id === paperId)?.title ?? paperId;
}

function looksCorruptText(value: string): boolean {
  return /�|怨|諛|鍮|吏|濡|瑜|媛|쒕|쑝|[?]{2,}/.test(value);
}

function displayEdgeLabel(edge: PaperEdge): string {
  return edge.label && !looksCorruptText(edge.label)
    ? edge.label
    : RELATION_LABELS[edge.relationType];
}

function displayEdgeDescription(edge: PaperEdge, graph: GraphData | null): string {
  const description = edge.longDescription || edge.shortDescription;
  if (description && !looksCorruptText(description)) return description;
  return `${getPaperTitle(graph, edge.source)} ${
    edge.directed ? "->" : "-"
  } ${getPaperTitle(graph, edge.target)} (${RELATION_LABELS[edge.relationType]})`;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.status === 504
        ? "ANALYSIS_TIMEOUT: Large PDF analysis exceeded the server time limit."
        : `INVALID_SERVER_RESPONSE_${response.status}: ${text.slice(0, 160)}`
    );
  }
}

function emptyCreateEdgeForm(graph: GraphData | null): CreateEdgeForm {
  return {
    source: graph?.nodes[0]?.id ?? "",
    target: graph?.nodes[1]?.id ?? "",
    directed: true,
    relationType: "custom",
    label: RELATION_LABELS.custom,
    shortDescription: "",
    longDescription: ""
  };
}

function analysisSettingsForm(settings: AnalysisSettings): AnalysisSettingsForm {
  return {
    semanticEdgeLimitPerPaper: String(settings.semanticEdgeLimitPerPaper),
    candidateLimitPerNewPaper: String(settings.candidateLimitPerNewPaper),
    minConfidenceForAutoEdge: String(settings.minConfidenceForAutoEdge),
    minConfidenceForSuggestion: String(settings.minConfidenceForSuggestion),
    candidateTitleWeight: String(settings.candidateTitleWeight),
    candidateKeywordWeight: String(settings.candidateKeywordWeight),
    candidateSummaryWeight: String(settings.candidateSummaryWeight),
    candidateMinScore: String(settings.candidateMinScore),
    includeZeroScoreCandidates: settings.includeZeroScoreCandidates,
    customEdgePrompt: settings.customEdgePrompt
  };
}

function parseAnalysisSettingsForm(form: AnalysisSettingsForm): AnalysisSettings {
  return {
    semanticEdgeLimitPerPaper: Number(form.semanticEdgeLimitPerPaper),
    candidateLimitPerNewPaper: Number(form.candidateLimitPerNewPaper),
    minConfidenceForAutoEdge: Number(form.minConfidenceForAutoEdge),
    minConfidenceForSuggestion: Number(form.minConfidenceForSuggestion),
    candidateTitleWeight: Number(form.candidateTitleWeight),
    candidateKeywordWeight: Number(form.candidateKeywordWeight),
    candidateSummaryWeight: Number(form.candidateSummaryWeight),
    candidateMinScore: Number(form.candidateMinScore),
    includeZeroScoreCandidates: form.includeZeroScoreCandidates,
    customEdgePrompt: form.customEdgePrompt
  };
}

export default function GraphWorkspace({ projectId }: { projectId: string }) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState("Loading graph");
  const [query, setQuery] = useState("");
  const [activeRelations, setActiveRelations] = useState<Set<RelationType>>(new Set());
  const [editing, setEditing] = useState(false);
  const [edgeForm, setEdgeForm] = useState<EdgeForm | null>(null);
  const [createEdgeForm, setCreateEdgeForm] = useState<CreateEdgeForm>(emptyCreateEdgeForm(null));
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthStatus | null>(null);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(420);
  const [shapeMode, setShapeMode] = useState<NodeShapeMode>("square");
  const [hoveredEdge, setHoveredEdge] = useState<PaperEdge | null>(null);
  const [relationColors, setRelationColors] = useState<RelationColorMap>(
    DEFAULT_RELATION_EDGE_COLORS
  );
  const [relationLineStyles, setRelationLineStyles] = useState<RelationLineStyleMap>(
    DEFAULT_RELATION_EDGE_LINE_STYLES
  );
  const [showPaperBrowser, setShowPaperBrowser] = useState(false);
  const [showAnalysisSettings, setShowAnalysisSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [freeMoveMode, setFreeMoveMode] = useState(false);
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [isRefreshingEdges, setIsRefreshingEdges] = useState(false);
  const [analysisForm, setAnalysisForm] = useState<AnalysisSettingsForm>(
    analysisSettingsForm(DEFAULT_ANALYSIS_SETTINGS)
  );

  const startResize = (side: "left" | "right") => (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      if (side === "left") {
        setLeftWidth(Math.max(240, Math.min(560, startWidth + delta)));
      } else {
        setRightWidth(Math.max(320, Math.min(680, startWidth - delta)));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const loadGoogleAuthStatus = useCallback(async () => {
    const response = await fetch("/api/auth/google/status");
    const json = (await response.json()) as { success: boolean } & GoogleAuthStatus;
    if (!json.success) throw new Error("GOOGLE_AUTH_STATUS_FAILED");
    setGoogleAuth({ connected: json.connected, user: json.user });
  }, []);

  const loadGraph = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/graph`);
    const json = (await response.json()) as { success: boolean; graph: GraphData };
    if (!json.success) throw new Error("GRAPH_LOAD_FAILED");
    setGraph(json.graph);
    setRelationColors({
      ...DEFAULT_RELATION_EDGE_COLORS,
      ...(json.graph.uiSettings?.edgeColors ?? {})
    });
    setRelationLineStyles({
      ...DEFAULT_RELATION_EDGE_LINE_STYLES,
      ...(json.graph.uiSettings?.edgeLineStyles ?? {})
    });
    setShapeMode(json.graph.uiSettings?.nodeShapeMode ?? "square");
    setShowEdgeLabels(json.graph.uiSettings?.showEdgeLabels ?? true);
    setFreeMoveMode(json.graph.uiSettings?.freeMoveMode ?? false);
    setAnalysisForm(analysisSettingsForm(json.graph.analysisSettings));
    setCreateEdgeForm((current) =>
      current.source && current.target ? current : emptyCreateEdgeForm(json.graph)
    );
    setStatus(`Loaded ${json.graph.nodes.length} papers and ${json.graph.edges.length} edges`);
  }, [projectId]);

  useEffect(() => {
    if (window.location.hash === "#edge-generation-settings") {
      setShowAnalysisSettings(true);
    } else if (window.location.hash === "#help") {
      setShowHelp(true);
    }
    loadGoogleAuthStatus().catch(() => setGoogleAuth({ connected: false, user: null }));
    loadGraph().catch((error) => setStatus((error as Error).message));
  }, [loadGraph, loadGoogleAuthStatus]);

  const visibleEdges = useMemo(
    () =>
      graph
        ? toReactFlowEdges(
            graph,
            activeRelations,
            relationColors,
            relationLineStyles,
            showEdgeLabels
          )
        : [],
    [graph, activeRelations, relationColors, relationLineStyles, showEdgeLabels]
  );

  const visibleNodeIds = useMemo(() => {
    if (!graph) return new Set<string>();
    if (activeRelations.size === 0) return new Set(graph.nodes.map((paper) => paper.id));
    const ids = new Set<string>();
    visibleEdges.forEach((edge) => {
      ids.add(edge.source);
      ids.add(edge.target);
    });
    return ids;
  }, [graph, activeRelations, visibleEdges]);

  const computedNodes = useMemo(
    () => (graph ? toReactFlowNodes(graph, visibleNodeIds, shapeMode) : []),
    [graph, visibleNodeIds, shapeMode]
  );

  useEffect(() => {
    setFlowNodes(computedNodes);
  }, [computedNodes]);

  const filteredPapers = useMemo(() => {
    if (!graph) return [];
    const value = query.trim().toLowerCase();
    const papers = graph.nodes.filter((paper) => visibleNodeIds.has(paper.id));
    if (!value) return papers;
    return papers.filter((paper) =>
      [paper.title, paper.summary, paper.keywords.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [graph, query, visibleNodeIds]);

  const selectedPaperEdges = useMemo(() => {
    if (!graph || selected?.kind !== "paper") return [];
    return graph.edges.filter(
      (edge) => edge.source === selected.paper.id || edge.target === selected.paper.id
    );
  }, [graph, selected]);

  const sidebarPapers = filteredPapers.slice(0, 10);
  const pendingSuggestions = graph?.edgeSuggestions.filter((item) => item.status === "pending") ?? [];

  const uploadPdf = async (file: File) => {
    if (file.size <= 0) {
      setStatus("PDF file is empty");
      return;
    }

    const duplicate = findPotentialDuplicate(graph, file);
    if (duplicate) {
      const confirmed = window.confirm(
        `A paper with the same filename or title may already exist:\n\n${duplicate.title}\n\nUpload anyway?`
      );
      if (!confirmed) {
        setStatus("Upload canceled because a potential duplicate was found");
        return;
      }
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    try {
      if (googleAuth?.connected) {
        await uploadPdfThroughDrive(file);
      } else {
        setStatus("Uploading PDF and running incremental analysis");
        const response = await fetch(`/api/projects/${projectId}/papers/upload`, {
          method: "POST",
          body: formData
        });
        await applyUploadResponse(response);
      }
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const applyUploadResponse = async (response: Response) => {
    const json = await readJsonResponse<{
      success: boolean;
      graph?: GraphData;
      error?: string;
    }>(response);
    if (!response.ok || !json.success || !json.graph) {
      throw new Error(json.error ?? `UPLOAD_FAILED_${response.status}`);
    }
    setGraph(json.graph);
    setSelected(null);
    setStatus(`Upload complete: ${json.graph.nodes.length} papers, ${json.graph.edges.length} edges`);
  };

  const uploadPdfThroughDrive = async (file: File) => {
    setStatus("Preparing Google Drive upload");
    const sessionResponse = await fetch(
      `/api/projects/${projectId}/papers/drive-upload-session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          mimeType: file.type || "application/pdf"
        })
      }
    );
    const session = (await sessionResponse.json()) as {
      success: boolean;
      uploadUrl?: string;
      error?: string;
    };
    if (!sessionResponse.ok || !session.success || !session.uploadUrl) {
      throw new Error(session.error ?? `DRIVE_UPLOAD_SESSION_FAILED_${sessionResponse.status}`);
    }

    const driveFile = await uploadFileToDriveInChunks(file, session.uploadUrl);
    if (!driveFile.id) throw new Error("DRIVE_UPLOAD_FILE_ID_MISSING");

    const sizeMb = file.size / 1024 / 1024;
    setStatus(
      sizeMb >= LARGE_PDF_ANALYSIS_MB
        ? "Analyzing Google Drive PDF. Large files can take a few minutes."
        : "Analyzing Google Drive PDF"
    );
    const analyzeResponse = await fetch(
      `/api/projects/${projectId}/papers/analyze-drive-file`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveFileId: driveFile.id })
      }
    );
    await applyUploadResponse(analyzeResponse);
  };

  const uploadFileToDriveInChunks = async (
    file: File,
    uploadUrl: string
  ): Promise<DriveUploadResult> => {
    let uploaded = 0;

    while (uploaded < file.size) {
      const endExclusive = Math.min(uploaded + DRIVE_UPLOAD_CHUNK_SIZE, file.size);
      const endInclusive = endExclusive - 1;
      const chunk = file.slice(uploaded, endExclusive);

      setStatus(`Uploading PDF to Google Drive ${Math.round((endExclusive / file.size) * 100)}%`);
      const response = await fetch(`/api/projects/${projectId}/papers/drive-upload-chunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Drive-Upload-Url": uploadUrl,
          "X-Upload-Start": String(uploaded),
          "X-Upload-End": String(endInclusive),
          "X-Upload-Total": String(file.size),
          "X-Upload-Content-Type": file.type || "application/pdf"
        },
        body: chunk
      });
      const json = (await response.json()) as DriveChunkResponse;

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? `DRIVE_CHUNK_UPLOAD_FAILED_${response.status}`);
      }
      if (json.done) {
        if (!json.file) throw new Error("DRIVE_UPLOAD_FILE_METADATA_MISSING");
        return json.file;
      }

      uploaded = endExclusive;
    }

    throw new Error("DRIVE_UPLOAD_INCOMPLETE");
  };

  const connectGoogleDrive = () => {
    window.location.href = `/api/auth/google/start?projectId=${encodeURIComponent(projectId)}`;
  };

  const logoutGoogleDrive = async () => {
    const response = await fetch("/api/auth/google/logout", { method: "POST" });
    const json = (await response.json()) as { success: boolean; error?: string };
    if (!json.success) {
      setStatus(json.error ?? "GOOGLE_LOGOUT_FAILED");
      return;
    }
    setGoogleAuth({ connected: false, user: null });
    setStatus("Google Drive disconnected");
  };

  const toggleRelation = (relationType: RelationType) => {
    setActiveRelations((current) => {
      const next = new Set(current);
      if (next.has(relationType)) {
        next.delete(relationType);
      } else {
        next.add(relationType);
      }
      return next;
    });
  };

  const openCreateEdge = () => {
    setCreateEdgeForm((current) =>
      current.source && current.target ? { ...current, relationType: "custom", label: RELATION_LABELS.custom } : emptyCreateEdgeForm(graph)
    );
    setEditing(false);
    setSelected({ kind: "createEdge" });
  };

  const startEdgeEdit = (edge: PaperEdge) => {
    setEdgeForm({
      relationType: edge.relationType,
      label: edge.label,
      shortDescription: edge.shortDescription,
      longDescription: edge.longDescription
    });
    setEditing(true);
  };

  const saveEdge = async () => {
    if (!edgeForm || selected?.kind !== "edge") return;
    const response = await fetch(`/api/projects/${projectId}/edges/${selected.edge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edgeForm)
    });
    const json = (await response.json()) as {
      success: boolean;
      edge?: PaperEdge;
      graph?: GraphData;
      error?: string;
    };
    if (!json.success || !json.graph || !json.edge) {
      setStatus(json.error ?? "EDGE_SAVE_FAILED");
      return;
    }
    setGraph(json.graph);
    setSelected({ kind: "edge", edge: json.edge });
    setEditing(false);
    setStatus("Edge update saved permanently");
  };

  const deleteSelectedEdge = async () => {
    if (selected?.kind !== "edge") return;
    const confirmed = window.confirm("Delete this edge from graph.json?");
    if (!confirmed) return;

    const response = await fetch(`/api/projects/${projectId}/edges/${selected.edge.id}`, {
      method: "DELETE"
    });
    const json = (await response.json()) as { success: boolean; graph?: GraphData; error?: string };
    if (!json.success || !json.graph) {
      setStatus(json.error ?? "EDGE_DELETE_FAILED");
      return;
    }

    setGraph(json.graph);
    setSelected(null);
    setEditing(false);
    setStatus("Edge deleted permanently");
  };

  const deleteSelectedPaper = async () => {
    if (selected?.kind !== "paper") return;
    const connectedCount = selectedPaperEdges.length;
    const confirmed = window.confirm(
      `Delete this paper node from graph.json?\n\n${selected.paper.title}\n\n${connectedCount} connected edge(s) will also be removed. The original PDF file will stay in storage.`
    );
    if (!confirmed) return;

    const response = await fetch(`/api/projects/${projectId}/papers/${selected.paper.id}`, {
      method: "DELETE"
    });
    const json = (await response.json()) as { success: boolean; graph?: GraphData; error?: string };
    if (!json.success || !json.graph) {
      setStatus(json.error ?? "PAPER_DELETE_FAILED");
      return;
    }

    setGraph(json.graph);
    setSelected(null);
    setEditing(false);
    setStatus("Paper node deleted. Original PDF file was not deleted.");
  };

  const createEdgeFromForm = useCallback(async (
    form: CreateEdgeForm,
    options: { editAfterCreate?: boolean } = {}
  ) => {
    const response = await fetch(`/api/projects/${projectId}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const json = (await response.json()) as {
      success: boolean;
      edge?: PaperEdge;
      graph?: GraphData;
      error?: string;
    };
    if (!json.success || !json.graph || !json.edge) {
      setStatus(json.error ?? "EDGE_CREATE_FAILED");
      return;
    }
    setGraph(json.graph);
    setSelected({ kind: "edge", edge: json.edge });
    setActiveRelations((current) => {
      if (current.size === 0 || current.has(json.edge!.relationType)) return current;
      return new Set([...current, json.edge!.relationType]);
    });
    if (options.editAfterCreate) {
      setEdgeForm({
        relationType: json.edge.relationType,
        label: json.edge.label,
        shortDescription: json.edge.shortDescription,
        longDescription: json.edge.longDescription
      });
      setEditing(true);
      setStatus("Edge created. Edit the relationship details in the right panel.");
    } else {
      setStatus("Custom edge saved permanently");
    }
  }, [projectId]);

  const createEdge = async () => {
    await createEdgeFromForm(createEdgeForm);
  };

  const createEdgeByDrag = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) {
        setStatus("Cannot create an edge from a paper to itself.");
        return;
      }

      const form: CreateEdgeForm = {
        source: connection.source,
        target: connection.target,
        directed: true,
        relationType: "custom",
        label: RELATION_LABELS.custom,
        shortDescription: "사용자가 그래프에서 직접 연결한 관계입니다.",
        longDescription:
          "마우스 드래그로 생성된 사용자 정의 관계입니다. 오른쪽 패널에서 관계 유형과 설명을 수정하세요."
      };

      setCreateEdgeForm(form);
      await createEdgeFromForm(form, { editAfterCreate: true });
    },
    [createEdgeFromForm]
  );

  const saveUiSettings = async (partial: GraphUiSettings) => {
    const currentSettings = graph?.uiSettings ?? {};
    const nextSettings: GraphUiSettings = {
      ...currentSettings,
      edgeColors: relationColors,
      edgeLineStyles: relationLineStyles,
      nodeShapeMode: shapeMode,
      showEdgeLabels,
      freeMoveMode,
      ...partial
    };
    const response = await fetch(`/api/projects/${projectId}/graph`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiSettings: nextSettings })
    });
    const json = (await response.json()) as { success: boolean; graph?: GraphData; error?: string };
    if (!json.success || !json.graph) {
      setStatus(json.error ?? "UI_SETTINGS_SAVE_FAILED");
      return;
    }
    setGraph(json.graph);
    setStatus("Settings saved to graph.json");
  };

  const saveAnalysisSettings = async (
    options: { closeModal?: boolean; quiet?: boolean } = {}
  ): Promise<GraphData | null> => {
    const response = await fetch(`/api/projects/${projectId}/graph`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisSettings: parseAnalysisSettingsForm(analysisForm) })
    });
    const json = (await response.json()) as { success: boolean; graph?: GraphData; error?: string };
    if (!json.success || !json.graph) {
      setStatus(json.error ?? "ANALYSIS_SETTINGS_SAVE_FAILED");
      return null;
    }
    setGraph(json.graph);
    setAnalysisForm(analysisSettingsForm(json.graph.analysisSettings));
    if (options.closeModal ?? true) setShowAnalysisSettings(false);
    if (!options.quiet) setStatus("Edge generation settings saved for future uploads");
    return json.graph;
  };

  const refreshGeneratedEdges = async () => {
    if (!graph || graph.nodes.length < 2) {
      setStatus("At least two papers are required to refresh generated edges");
      return;
    }
    const confirmed = window.confirm(
      "Refresh existing generated edges with the current settings?\n\nThis will call the configured LLM for the papers in this graph. User-created and user-edited edges will be preserved."
    );
    if (!confirmed) return;

    setIsRefreshingEdges(true);
    try {
      const savedGraph = await saveAnalysisSettings({ closeModal: false, quiet: true });
      if (!savedGraph) return;

      setStatus("Refreshing generated edges with current settings");
      const response = await fetch(`/api/projects/${projectId}/edges/refresh`, {
        method: "POST"
      });
      const json = (await response.json()) as {
        success: boolean;
        graph?: GraphData;
        stats?: {
          preservedUserEdges: number;
          removedGeneratedEdges: number;
          generatedEdges: number;
          pendingSuggestions: number;
        };
        error?: string;
      };
      if (!json.success || !json.graph) {
        setStatus(json.error ?? "EDGE_REFRESH_FAILED");
        return;
      }

      setGraph(json.graph);
      setAnalysisForm(analysisSettingsForm(json.graph.analysisSettings));
      setShowAnalysisSettings(false);
      setStatus(
        `Refreshed generated edges: ${json.stats?.generatedEdges ?? json.graph.edges.length} edges, ${json.stats?.pendingSuggestions ?? 0} suggestions`
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsRefreshingEdges(false);
    }
  };

  const resetAnalysisSettings = () => {
    setAnalysisForm(analysisSettingsForm(DEFAULT_ANALYSIS_SETTINGS));
  };

  const updateRelationColor = (relationType: RelationType, color: string) => {
    const next = { ...relationColors, [relationType]: color };
    setRelationColors(next);
    void saveUiSettings({ edgeColors: next });
  };

  const resetRelationColors = () => {
    setRelationColors(DEFAULT_RELATION_EDGE_COLORS);
    void saveUiSettings({ edgeColors: DEFAULT_RELATION_EDGE_COLORS });
  };

  const updateRelationLineStyle = (relationType: RelationType, lineStyle: EdgeLineStyle) => {
    const next = { ...relationLineStyles, [relationType]: lineStyle };
    setRelationLineStyles(next);
    void saveUiSettings({ edgeLineStyles: next });
  };

  const resetRelationLineStyles = () => {
    setRelationLineStyles(DEFAULT_RELATION_EDGE_LINE_STYLES);
    void saveUiSettings({ edgeLineStyles: DEFAULT_RELATION_EDGE_LINE_STYLES });
  };

  const updateShapeMode = (mode: NodeShapeMode) => {
    setShapeMode(mode);
    void saveUiSettings({ nodeShapeMode: mode });
  };

  const updateShowEdgeLabels = (enabled: boolean) => {
    setShowEdgeLabels(enabled);
    void saveUiSettings({ showEdgeLabels: enabled });
  };

  const updateFreeMoveMode = (enabled: boolean) => {
    setFreeMoveMode(enabled);
    void saveUiSettings({ freeMoveMode: enabled });
  };

  const updateFlowNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      setFlowNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, position } : node))
      );
    },
    []
  );

  const saveNodePosition = async (nodeId: string, position: { x: number; y: number }) => {
    const nextPositions = {
      ...(graph?.uiSettings?.nodePositions ?? {}),
      [nodeId]: position
    };
    setGraph((current) =>
      current
        ? {
            ...current,
            uiSettings: {
              ...current.uiSettings,
              nodePositions: nextPositions
            }
          }
        : current
    );
    await saveUiSettings({ nodePositions: nextPositions });
  };

  const resetNodePositions = () => {
    setGraph((current) =>
      current
        ? {
            ...current,
            uiSettings: {
              ...current.uiSettings,
              nodePositions: {}
            }
          }
        : current
    );
    void saveUiSettings({ nodePositions: {} });
  };

  const updateSuggestion = async (suggestion: EdgeSuggestion, action: "accept" | "reject") => {
    const response = await fetch(
      `/api/projects/${projectId}/edge-suggestions/${suggestion.id}/${action}`,
      { method: "POST" }
    );
    const json = (await response.json()) as { success: boolean; graph?: GraphData; error?: string };
    if (!json.success || !json.graph) {
      setStatus(json.error ?? "SUGGESTION_UPDATE_FAILED");
      return;
    }
    setGraph(json.graph);
    setStatus(action === "accept" ? "Suggestion accepted" : "Suggestion rejected");
  };

  return (
    <main className="flex h-screen flex-col bg-neutral-50 text-neutral-950">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold tracking-normal">Deepen</h1>
          <span className="text-sm text-neutral-500">Paper Graph Memory</span>
        </div>
        <div className="flex items-center gap-2">
          {googleAuth?.connected ? (
            <>
              <div className="max-w-64 truncate border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-600">
                {googleAuth.user?.email ?? "Google Drive connected"}
              </div>
              <button
                className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
                onClick={() => void logoutGoogleDrive()}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
              onClick={connectGoogleDrive}
            >
              Connect Google Drive
            </button>
          )}
          <label className="cursor-pointer border border-neutral-950 bg-neutral-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800">
            {isUploading ? "Analyzing" : "Upload PDF"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadPdf(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button
            className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
            onClick={() => void loadGraph()}
          >
            Reload
          </button>
        </div>
      </header>

      <section
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: `${leftWidth}px 8px minmax(0,1fr) 8px ${rightWidth}px` }}
      >
        <aside
          className="resizable-panel min-h-0 border-r border-neutral-200 bg-white"
          style={{ "--panel-font-size": panelFontSize(leftWidth) } as React.CSSProperties}
        >
          <div className="border-b border-neutral-200 p-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search papers"
              className="w-full border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-950"
            />
          </div>
          <div className="h-[calc(100vh-7.5rem)] overflow-auto p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-neutral-500">Paper List</span>
              <span className="text-xs text-neutral-400">
                {Math.min(filteredPapers.length, 10)} / {filteredPapers.length}
              </span>
            </div>
            <div className="space-y-2">
              {sidebarPapers.map((paper) => (
                <button
                  key={paper.id}
                  className="block w-full border border-neutral-200 bg-white p-2 text-left hover:bg-neutral-100"
                  onClick={() => setSelected({ kind: "paper", paper })}
                  title={paper.shortSummary}
                >
                  <div className="line-clamp-2 text-sm font-medium">{paper.title}</div>
                  <div className="mt-1 text-xs text-neutral-500">{paper.year ?? "Unknown year"}</div>
                </button>
              ))}
              {filteredPapers.length > 10 && (
                <button
                  className="w-full border border-neutral-950 bg-white px-3 py-2 text-left text-sm font-semibold hover:bg-neutral-100"
                  onClick={() => setShowPaperBrowser(true)}
                >
                  더 보기 ({filteredPapers.length - 10} more)
                </button>
              )}
              {!filteredPapers.length && (
                <div className="border border-neutral-200 p-3 text-xs text-neutral-500">
                  No visible papers
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-neutral-500">
                  Relation Filters
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs text-neutral-500 underline"
                    onClick={() => setActiveRelations(new Set())}
                  >
                    all
                  </button>
                  <button
                    className="text-xs text-neutral-500 underline"
                    onClick={resetRelationColors}
                  >
                    reset colors
                  </button>
                  <button
                    className="text-xs text-neutral-500 underline"
                    onClick={resetRelationLineStyles}
                  >
                    reset lines
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                {RELATION_TYPES.map((type) => {
                  const active = activeRelations.has(type);
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-2 border border-neutral-200 bg-white p-1"
                    >
                      <button
                        className={[
                          "min-w-0 flex-1 px-3 py-2 text-left",
                          active
                            ? "bg-neutral-950 text-white"
                            : "text-neutral-700 hover:bg-neutral-100"
                        ].join(" ")}
                        onClick={() => toggleRelation(type)}
                      >
                        {RELATION_LABELS[type]}
                      </button>
                      <input
                        type="color"
                        value={relationColors[type]}
                        onChange={(event) => updateRelationColor(type, event.target.value)}
                        className="h-8 w-10 shrink-0 cursor-pointer border border-neutral-300 bg-white p-0"
                        aria-label={`${RELATION_LABELS[type]} edge color`}
                      />
                      <select
                        value={relationLineStyles[type]}
                        onChange={(event) =>
                          updateRelationLineStyle(type, event.target.value as EdgeLineStyle)
                        }
                        className="h-8 w-20 shrink-0 border border-neutral-300 bg-white px-1 text-xs"
                        aria-label={`${RELATION_LABELS[type]} line style`}
                      >
                        {EDGE_LINE_STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              <button
                className="mt-3 w-full border border-neutral-950 bg-white px-3 py-2 text-left text-sm font-semibold hover:bg-neutral-100"
                onClick={openCreateEdge}
              >
                + 사용자 정의 edge 만들기
              </button>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-4">
              <div className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                설정
              </div>
              <div className="space-y-3 border border-neutral-200 bg-white p-2">
                <div>
                  <div className="mb-1 text-xs font-semibold text-neutral-500">Node shape</div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      className={[
                        "border px-2 py-2 text-sm",
                        shapeMode === "square"
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-200"
                      ].join(" ")}
                      onClick={() => updateShapeMode("square")}
                    >
                      사각 노드
                    </button>
                    <button
                      className={[
                        "border px-2 py-2 text-sm",
                        shapeMode === "circle"
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-200"
                      ].join(" ")}
                      onClick={() => updateShapeMode("circle")}
                    >
                      동글 노드
                    </button>
                  </div>
                </div>
                <button
                  className="flex w-full items-center justify-between border border-neutral-200 px-2 py-2 text-left text-sm hover:bg-neutral-100"
                  onClick={() => updateShowEdgeLabels(!showEdgeLabels)}
                >
                  <span>엣지 속성 글자</span>
                  <span className={showEdgeLabels ? "font-semibold text-neutral-950" : "text-neutral-500"}>
                    {showEdgeLabels ? "ON" : "OFF"}
                  </span>
                </button>
                <button
                  className="flex w-full items-center justify-between border border-neutral-200 px-2 py-2 text-left text-sm hover:bg-neutral-100"
                  onClick={() => updateFreeMoveMode(!freeMoveMode)}
                >
                  <span>자유이동모드</span>
                  <span className={freeMoveMode ? "font-semibold text-neutral-950" : "text-neutral-500"}>
                    {freeMoveMode ? "ON" : "OFF"}
                  </span>
                </button>
                <button
                  className="flex w-full items-center justify-between border border-neutral-200 px-2 py-2 text-left text-sm hover:bg-neutral-100"
                  onClick={resetNodePositions}
                >
                  <span>노드 위치 리셋</span>
                  <span className="text-neutral-500">reset</span>
                </button>
                <button
                  className="flex w-full items-center justify-between border border-neutral-950 px-2 py-2 text-left text-sm font-semibold hover:bg-neutral-100"
                  onClick={() => setShowAnalysisSettings(true)}
                >
                  <span>Edge generation details</span>
                  <span className="text-neutral-500">more</span>
                </button>
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-4">
              <div className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                Pending Suggestions
              </div>
              <div className="space-y-2">
                {pendingSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="border border-neutral-200 p-2">
                    <div className="text-xs font-medium">{suggestion.suggestedLabel}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{suggestion.reason}</p>
                    <div className="mt-2 flex gap-1">
                      <button
                        className="border border-neutral-950 px-2 py-1 text-xs"
                        onClick={() => void updateSuggestion(suggestion, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        className="border border-neutral-300 px-2 py-1 text-xs"
                        onClick={() => void updateSuggestion(suggestion, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {!pendingSuggestions.length && (
                  <div className="text-xs text-neutral-500">No pending suggestions</div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <div
          className="cursor-col-resize border-r border-neutral-200 bg-neutral-100 hover:bg-neutral-200"
          onMouseDown={startResize("left")}
          title="Drag to resize"
        />

        <div className="relative min-h-0 bg-neutral-50">
          <ReactFlow
            nodes={flowNodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            defaultEdgeOptions={{ type: "paperEdge" }}
            onNodeClick={(_, node) =>
              setSelected({ kind: "paper", paper: node.data.paper as PaperNodeType })
            }
            onEdgeClick={(_, edge) => {
              setSelected({ kind: "edge", edge: edge.data.edge as PaperEdge });
              setEditing(false);
            }}
            onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.data.edge as PaperEdge)}
            onEdgeMouseLeave={() => setHoveredEdge(null)}
            onConnect={(connection) => void createEdgeByDrag(connection)}
            connectionLineStyle={{ stroke: "#111827", strokeWidth: 2 }}
            connectionMode={ConnectionMode.Loose}
            nodesDraggable={freeMoveMode}
            onNodeDrag={(_, node) => updateFlowNodePosition(node.id, node.position)}
            onNodeDragStop={(_, node) => {
              updateFlowNodePosition(node.id, node.position);
              void saveNodePosition(node.id, node.position);
            }}
          >
            <Background color="#d4d4d4" gap={18} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={() => "#ffffff"}
              maskColor="rgba(245,245,245,0.8)"
            />
          </ReactFlow>
          {hoveredEdge && (
            <div className="pointer-events-none absolute bottom-12 left-1/2 z-20 w-[min(520px,40vw)] -translate-x-1/2 border border-neutral-300 bg-white p-3 text-sm shadow-md">
              <div className="font-semibold text-neutral-950">
                {displayEdgeLabel(hoveredEdge)} / {RELATION_LABELS[hoveredEdge.relationType]}
              </div>
              <div className="mt-1 text-neutral-700">
                {displayEdgeDescription(hoveredEdge, graph)}
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                confidence {hoveredEdge.confidence.toFixed(2)} · {hoveredEdge.relationSource}
              </div>
            </div>
          )}
          <button
            className="absolute bottom-4 right-4 z-30 border border-neutral-950 bg-white px-4 py-2 text-sm font-semibold shadow-md hover:bg-neutral-100"
            onClick={() => setShowHelp(true)}
          >
            도움말
          </button>
        </div>

        <div
          className="cursor-col-resize border-l border-neutral-200 bg-neutral-100 hover:bg-neutral-200"
          onMouseDown={startResize("right")}
          title="Drag to resize"
        />

        <aside
          className="resizable-panel min-h-0 overflow-auto border-l border-neutral-200 bg-white p-4"
          style={{ "--panel-font-size": panelFontSize(rightWidth) } as React.CSSProperties}
        >
          <div className="mb-4 text-xs font-semibold uppercase text-neutral-500">Detail Panel</div>
          {!selected && (
            <div className="text-sm text-neutral-500">
              Select a node or edge to inspect graph memory.
            </div>
          )}

          {selected?.kind === "createEdge" && graph && (
            <CreateEdgePanel
              graph={graph}
              form={createEdgeForm}
              setForm={setCreateEdgeForm}
              onCreate={() => void createEdge()}
            />
          )}

          {selected?.kind === "paper" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold leading-tight">{selected.paper.title}</h2>
                <div className="mt-2 text-sm text-neutral-600">
                  {formatAuthors(selected.paper.authors)}
                </div>
                <div className="text-sm text-neutral-500">
                  {selected.paper.year ?? "Unknown year"}
                </div>
              </div>
              <DetailBlock label="Summary" value={selected.paper.summary} />
              <DetailBlock label="Keywords" value={selected.paper.keywords.join(", ") || "None"} />
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-neutral-500">
                  Original PDF
                </div>
                {selected.paper.localFileId ? (
                  <a
                    className="text-sm underline"
                    href={`/api/projects/${projectId}/papers/${selected.paper.localFileId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selected.paper.originalFilename}
                  </a>
                ) : (
                  <div className="text-sm text-neutral-800">{selected.paper.originalFilename}</div>
                )}
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                  Connected Edges
                </div>
                <div className="space-y-2">
                  {selectedPaperEdges.map((edge) => (
                    <button
                      key={edge.id}
                      className="block w-full border border-neutral-200 p-2 text-left text-sm hover:bg-neutral-100"
                      onClick={() => setSelected({ kind: "edge", edge })}
                    >
                      <div className="font-medium">{displayEdgeLabel(edge)}</div>
                      <div className="text-xs text-neutral-500">
                        {displayEdgeDescription(edge, graph)}
                      </div>
                    </button>
                  ))}
                  {!selectedPaperEdges.length && (
                    <div className="text-sm text-neutral-500">No connected edges yet</div>
                  )}
                </div>
              </div>
              <div className="border-t border-neutral-200 pt-4">
                <button
                  className="border border-red-700 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  onClick={() => void deleteSelectedPaper()}
                >
                  Delete Paper Node
                </button>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  Removes this paper and connected edges from graph.json. The original PDF file is kept.
                </p>
              </div>
            </div>
          )}

          {selected?.kind === "edge" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{displayEdgeLabel(selected.edge)}</h2>
                <div className="text-sm text-neutral-500">
                  {getPaperTitle(graph, selected.edge.source)} {selected.edge.directed ? "->" : "-"}{" "}
                  {getPaperTitle(graph, selected.edge.target)}
                </div>
              </div>

              {!editing && (
                <>
                  <DetailBlock
                    label="Relation Type"
                    value={RELATION_LABELS[selected.edge.relationType]}
                  />
                  <DetailBlock
                    label="Short Description"
                    value={
                      looksCorruptText(selected.edge.shortDescription)
                        ? displayEdgeDescription(selected.edge, graph)
                        : selected.edge.shortDescription
                    }
                  />
                  <DetailBlock
                    label="Long Description"
                    value={displayEdgeDescription(selected.edge, graph)}
                  />
                  <DetailBlock label="Confidence" value={selected.edge.confidence.toFixed(2)} />
                  <DetailBlock label="Relation Source" value={selected.edge.relationSource} />
                  <DetailBlock label="Direction" value={selected.edge.directionMeaning} />
                  <DetailBlock
                    label="Evidence"
                    value={
                      selected.edge.evidence.map((item) => `${item.type}: ${item.text}`).join("\n") ||
                      "None"
                    }
                  />
                  <button
                    className="border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm text-white"
                    onClick={() => startEdgeEdit(selected.edge)}
                  >
                    Edit
                  </button>
                  <button
                    className="ml-2 border border-red-700 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    onClick={() => void deleteSelectedEdge()}
                  >
                    Delete
                  </button>
                </>
              )}

              {editing && edgeForm && (
                <div className="space-y-3">
                  <RelationTypeSelect
                    value={edgeForm.relationType}
                    onChange={(relationType) =>
                      setEdgeForm({
                        ...edgeForm,
                        relationType,
                        label:
                          edgeForm.label === RELATION_LABELS[edgeForm.relationType]
                            ? RELATION_LABELS[relationType]
                            : edgeForm.label
                      })
                    }
                  />
                  <TextInput
                    label="Label"
                    value={edgeForm.label}
                    onChange={(value) => setEdgeForm({ ...edgeForm, label: value })}
                  />
                  <TextArea
                    label="Short Description"
                    value={edgeForm.shortDescription}
                    onChange={(value) => setEdgeForm({ ...edgeForm, shortDescription: value })}
                  />
                  <TextArea
                    label="Long Description"
                    value={edgeForm.longDescription}
                    onChange={(value) => setEdgeForm({ ...edgeForm, longDescription: value })}
                  />
                  <div className="flex gap-2">
                    <button
                      className="border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm text-white"
                      onClick={() => void saveEdge()}
                    >
                      Save
                    </button>
                    <button
                      className="border border-neutral-300 px-3 py-2 text-sm"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </section>

      {showPaperBrowser && (
        <PaperBrowserModal
          papers={filteredPapers}
          query={query}
          onClose={() => setShowPaperBrowser(false)}
          onSelect={(paper) => {
            setSelected({ kind: "paper", paper });
            setShowPaperBrowser(false);
          }}
        />
      )}

      {showAnalysisSettings && (
        <AnalysisSettingsModal
          form={analysisForm}
          setForm={setAnalysisForm}
          onClose={() => setShowAnalysisSettings(false)}
          onReset={resetAnalysisSettings}
          onSave={() => void saveAnalysisSettings()}
          onRefreshEdges={() => void refreshGeneratedEdges()}
          isRefreshingEdges={isRefreshingEdges}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <footer className="h-8 shrink-0 border-t border-neutral-200 bg-white px-4 py-1 text-xs text-neutral-500">
        {status}
      </footer>
    </main>
  );
}

function AnalysisSettingsModal({
  form,
  setForm,
  onClose,
  onReset,
  onSave,
  onRefreshEdges,
  isRefreshingEdges
}: {
  form: AnalysisSettingsForm;
  setForm: (form: AnalysisSettingsForm) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
  onRefreshEdges: () => void;
  isRefreshingEdges: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 p-4">
      <div className="mx-auto flex h-full max-w-3xl flex-col border border-neutral-300 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Edge Generation Settings</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Saved in graph.json and applied only when a new paper is uploaded.
            </p>
          </div>
          <button className="border border-neutral-300 px-3 py-1.5 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <NumberInput
              label="Max auto edges per new paper"
              value={form.semanticEdgeLimitPerPaper}
              min={1}
              max={20}
              step={1}
              onChange={(semanticEdgeLimitPerPaper) =>
                setForm({ ...form, semanticEdgeLimitPerPaper })
              }
            />
            <NumberInput
              label="Candidate papers sent to LLM"
              value={form.candidateLimitPerNewPaper}
              min={1}
              max={50}
              step={1}
              onChange={(candidateLimitPerNewPaper) =>
                setForm({ ...form, candidateLimitPerNewPaper })
              }
            />
            <NumberInput
              label="Auto edge confidence threshold"
              value={form.minConfidenceForAutoEdge}
              min={0}
              max={1}
              step={0.01}
              onChange={(minConfidenceForAutoEdge) =>
                setForm({ ...form, minConfidenceForAutoEdge })
              }
            />
            <NumberInput
              label="Suggestion confidence threshold"
              value={form.minConfidenceForSuggestion}
              min={0}
              max={1}
              step={0.01}
              onChange={(minConfidenceForSuggestion) =>
                setForm({ ...form, minConfidenceForSuggestion })
              }
            />
            <NumberInput
              label="Title match weight"
              value={form.candidateTitleWeight}
              min={0}
              max={10}
              step={0.1}
              onChange={(candidateTitleWeight) =>
                setForm({ ...form, candidateTitleWeight })
              }
            />
            <NumberInput
              label="Keyword match weight"
              value={form.candidateKeywordWeight}
              min={0}
              max={10}
              step={0.1}
              onChange={(candidateKeywordWeight) =>
                setForm({ ...form, candidateKeywordWeight })
              }
            />
            <NumberInput
              label="Summary match weight"
              value={form.candidateSummaryWeight}
              min={0}
              max={10}
              step={0.1}
              onChange={(candidateSummaryWeight) =>
                setForm({ ...form, candidateSummaryWeight })
              }
            />
            <NumberInput
              label="Minimum candidate score"
              value={form.candidateMinScore}
              min={0}
              max={1}
              step={0.01}
              onChange={(candidateMinScore) => setForm({ ...form, candidateMinScore })}
            />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.includeZeroScoreCandidates}
              onChange={(event) =>
                setForm({ ...form, includeZeroScoreCandidates: event.target.checked })
              }
            />
            Include fallback candidates even when lexical score is zero
          </label>
          <div className="mt-4">
            <TextArea
              label="Custom edge policy prompt"
              value={form.customEdgePrompt}
              onChange={(customEdgePrompt) => setForm({ ...form, customEdgePrompt })}
            />
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Example: Prefer method-transfer edges over broad background edges. Do not create
              edges unless the relation can be justified from both summaries.
            </p>
          </div>
          <div className="mt-4 border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-neutral-950">
                  Refresh existing generated edges
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Saves these settings, removes generated edges and pending suggestions, then
                  regenerates them with the configured LLM. User-created and user-edited edges stay.
                </p>
              </div>
              <button
                className="shrink-0 border border-neutral-950 bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
                disabled={isRefreshingEdges}
                onClick={onRefreshEdges}
              >
                {isRefreshingEdges ? "Refreshing..." : "Refresh Edges"}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-between border-t border-neutral-200 px-4 py-3">
          <button className="border border-neutral-300 px-3 py-2 text-sm" onClick={onReset}>
            Reset defaults
          </button>
          <div className="flex gap-2">
            <button className="border border-neutral-300 px-3 py-2 text-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm text-white"
              onClick={onSave}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const sections = [
    {
      title: "논문 업로드와 자동 분석",
      body:
        "Upload PDF 버튼으로 논문을 올리면 원본 PDF가 현재 저장소에 보관되고, 앱이 본문 텍스트를 추출한 뒤 LLM이 제목, 저자, 연도, 초록, 요약, 키워드를 구조화합니다. 분석이 끝나면 새 논문 노드가 그래프에 추가되어 이후 검색, 관계 비교, PDF 다시 열기에 활용됩니다."
    },
    {
      title: "자동 엣지 생성",
      body:
        "새 논문이 들어올 때마다 기존 논문들의 제목, 키워드, 요약을 기준으로 후보 논문을 고르고, LLM이 두 논문 사이의 관계를 판단합니다. 확장, 선행 연구, 방법 사용, 비교, 개념 연결 같은 관계 타입을 사용하며, 신뢰도가 충분하면 자동 엣지로 저장하고 애매하면 제안 목록에 남깁니다."
    },
    {
      title: "그래프 탐색",
      body:
        "가운데 캔버스는 논문 지식 지도를 보여줍니다. 노드는 논문이고 선은 관계입니다. 확대, 축소, 미니맵 이동을 통해 큰 그래프를 빠르게 훑을 수 있으며, 엣지에 마우스를 올리면 관계 설명과 신뢰도를 바로 확인할 수 있습니다."
    },
    {
      title: "논문 목록과 검색",
      body:
        "왼쪽 패널에서는 저장된 논문을 목록으로 보고 제목 기준으로 검색할 수 있습니다. 목록의 논문을 누르면 오른쪽 상세 패널에서 요약, 키워드, 연결된 엣지, 원본 PDF 링크를 확인할 수 있습니다."
    },
    {
      title: "관계 필터와 시각 스타일",
      body:
        "Relation Filters에서 관계 타입별 표시 여부를 켜고 끌 수 있습니다. 각 관계 타입마다 색상과 선 모양도 바꿀 수 있어 발표용, 검토용, 연구 정리용 그래프를 원하는 방식으로 읽기 쉽게 만들 수 있습니다."
    },
    {
      title: "수동 엣지 생성과 수정",
      body:
        "자동 분석이 놓친 관계가 있으면 + 사용자 정의 edge 만들기 또는 그래프에서 노드끼리 드래그해 직접 연결할 수 있습니다. 오른쪽 패널에서 관계 타입, 라벨, 짧은 설명, 긴 설명을 수정하면 graph.json에 영구 저장됩니다."
    },
    {
      title: "제안 검토",
      body:
        "LLM이 기존 엣지와 충돌하거나 신뢰도가 자동 저장 기준보다 낮다고 판단한 관계는 Pending Suggestions에 들어갑니다. 사용자는 Accept 또는 Reject로 그래프에 반영할지 직접 결정할 수 있어 자동화와 사용자의 판단을 함께 사용할 수 있습니다."
    },
    {
      title: "저장소와 Google Drive",
      body:
        "기본 로컬 모드에서는 PDF와 graph.json이 local_data 아래에 저장됩니다. Google Drive를 연결하고 저장 백엔드를 Drive로 설정하면 같은 그래프와 설정이 Drive에 저장되어 다른 세션에서도 이어서 사용할 수 있습니다."
    },
    {
      title: "엣지 생성 세부 설정",
      body:
        "Settings의 Edge generation details에서 후보 논문 수, 자동 엣지 개수, 신뢰도 기준, 제목/키워드/요약 가중치, 커스텀 정책 프롬프트를 조정할 수 있습니다. 이 설정은 새 논문이 업로드될 때만 적용되며 기존 그래프를 자동으로 다시 쓰지 않습니다."
    },
    {
      title: "화면 설정",
      body:
        "Settings에서 노드 모양, 엣지 라벨 표시, 자유 이동 모드, 노드 위치 초기화를 제어할 수 있습니다. 자유 이동 모드를 켜면 노드를 직접 배치할 수 있고, 위치는 graph.json에 저장되어 다음 접속 때도 유지됩니다."
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/35 p-4">
      <div className="mx-auto flex h-full max-w-4xl flex-col border border-neutral-300 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Deepen 사용 도움말</h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              논문을 업로드하고, 요약하고, 관계 그래프로 정리하는 전체 흐름을 기능별로 설명합니다.
            </p>
          </div>
          <button
            className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-300 text-lg font-semibold hover:bg-neutral-100"
            onClick={onClose}
            aria-label="도움말 닫기"
            title="닫기"
          >
            X
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            {sections.map((section) => (
              <section key={section.title} className="border border-neutral-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-neutral-950">{section.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
        <div className="border-t border-neutral-200 px-5 py-3 text-xs leading-relaxed text-neutral-500">
          설정과 그래프 데이터는 현재 프로젝트의 graph.json에 저장됩니다. 새 PDF를 넣을 때 자동 분석 설정이 적용되고,
          이미 저장된 엣지는 사용자가 직접 수정하거나 삭제하기 전까지 유지됩니다.
        </div>
      </div>
    </div>
  );
}

function PaperBrowserModal({
  papers,
  query,
  onClose,
  onSelect
}: {
  papers: PaperNodeType[];
  query: string;
  onClose: () => void;
  onSelect: (paper: PaperNodeType) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
      <div className="flex h-[min(720px,86vh)] w-[min(980px,92vw)] flex-col border border-neutral-300 bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">All Papers</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {papers.length} visible papers{query ? ` matching "${query}"` : ""}
            </p>
          </div>
          <button
            className="border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="grid gap-2 md:grid-cols-2">
            {papers.map((paper) => (
              <button
                key={paper.id}
                className="border border-neutral-200 bg-white p-3 text-left hover:border-neutral-950 hover:bg-neutral-50"
                onClick={() => onSelect(paper)}
                title={paper.shortSummary}
              >
                <div className="line-clamp-2 text-sm font-semibold leading-snug">
                  {paper.title}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {paper.year ?? "Unknown year"} · {paper.authors.slice(0, 3).join(", ") || "Unknown authors"}
                </div>
                <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-600">
                  {paper.shortSummary || paper.summary}
                </div>
              </button>
            ))}
          </div>
          {!papers.length && (
            <div className="border border-neutral-200 p-4 text-sm text-neutral-500">
              No papers match the current filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateEdgePanel({
  graph,
  form,
  setForm,
  onCreate
}: {
  graph: GraphData;
  form: CreateEdgeForm;
  setForm: (form: CreateEdgeForm) => void;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">사용자 정의 edge</h2>
        <p className="mt-1 text-sm text-neutral-500">
          관계가 약하거나 애매해도 직접 연결할 수 있습니다. 저장하면 graph.json에 영구 반영됩니다.
        </p>
      </div>
      <PaperSelect
        label="Source"
        papers={graph.nodes}
        value={form.source}
        onChange={(source) => setForm({ ...form, source })}
      />
      <PaperSelect
        label="Target"
        papers={graph.nodes}
        value={form.target}
        onChange={(target) => setForm({ ...form, target })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.directed}
          onChange={(event) => setForm({ ...form, directed: event.target.checked })}
        />
        Directed edge
      </label>
      <RelationTypeSelect
        value={form.relationType}
        onChange={(relationType) =>
          setForm({
            ...form,
            relationType,
            label: form.label === RELATION_LABELS[form.relationType] ? RELATION_LABELS[relationType] : form.label
          })
        }
      />
      <TextInput label="Label" value={form.label} onChange={(label) => setForm({ ...form, label })} />
      <TextArea
        label="Short Description"
        value={form.shortDescription}
        onChange={(shortDescription) => setForm({ ...form, shortDescription })}
      />
      <TextArea
        label="Long Description"
        value={form.longDescription}
        onChange={(longDescription) => setForm({ ...form, longDescription })}
      />
      <button
        className="border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm text-white"
        onClick={onCreate}
      >
        Create Edge
      </button>
    </div>
  );
}

function PaperSelect({
  label,
  papers,
  value,
  onChange
}: {
  label: string;
  papers: PaperNodeType[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-neutral-300 bg-white px-2 py-2"
      >
        {papers.map((paper) => (
          <option key={paper.id} value={paper.id}>
            {paper.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function RelationTypeSelect({
  value,
  onChange
}: {
  value: RelationType;
  onChange: (value: RelationType) => void;
}) {
  return (
    <label className="block text-sm">
      Relation Type
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as RelationType)}
        className="mt-1 w-full border border-neutral-300 bg-white px-2 py-2"
      >
        {RELATION_TYPES.map((type) => (
          <option key={type} value={type}>
            {RELATION_LABELS[type]}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase text-neutral-500">{label}</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{value}</div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-neutral-300 px-2 py-2"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-neutral-300 px-2 py-2"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-1 w-full resize-none border border-neutral-300 px-2 py-2"
      />
    </label>
  );
}
