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

type GoogleAuthStatus = {
  connected: boolean;
  user: { email: string; name?: string | null } | null;
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
            title={edge.longDescription || edge.shortDescription}
          >
            <div
              className="edge-label-pill"
              style={{
                borderColor: `${stroke}55`,
                color: stroke
              }}
            >
              {edge.label}
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

function getPaperTitle(graph: GraphData | null, paperId: string) {
  return graph?.nodes.find((paper) => paper.id === paperId)?.title ?? paperId;
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
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [freeMoveMode, setFreeMoveMode] = useState(false);

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
    setCreateEdgeForm((current) =>
      current.source && current.target ? current : emptyCreateEdgeForm(json.graph)
    );
    setStatus(`Loaded ${json.graph.nodes.length} papers and ${json.graph.edges.length} edges`);
  }, [projectId]);

  useEffect(() => {
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

  const nodes = useMemo(
    () => (graph ? toReactFlowNodes(graph, visibleNodeIds, shapeMode) : []),
    [graph, visibleNodeIds, shapeMode]
  );

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
    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    setStatus("Uploading PDF and running incremental analysis");
    try {
      const response = await fetch(`/api/projects/${projectId}/papers/upload`, {
        method: "POST",
        body: formData
      });
      const json = (await response.json()) as {
        success: boolean;
        graph?: GraphData;
        error?: string;
      };
      if (!json.success || !json.graph) throw new Error(json.error ?? "UPLOAD_FAILED");
      setGraph(json.graph);
      setSelected(null);
      setStatus(`Upload complete: ${json.graph.nodes.length} papers, ${json.graph.edges.length} edges`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const connectGoogleDrive = () => {
    window.location.href = `/api/auth/google/start?projectId=${encodeURIComponent(projectId)}`;
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
            <div className="max-w-64 truncate border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-600">
              {googleAuth.user?.email ?? "Google Drive connected"}
            </div>
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
            nodes={nodes}
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
            onNodeDragStop={(_, node) => void saveNodePosition(node.id, node.position)}
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
                {hoveredEdge.label} / {RELATION_LABELS[hoveredEdge.relationType]}
              </div>
              <div className="mt-1 text-neutral-700">
                {hoveredEdge.longDescription || hoveredEdge.shortDescription}
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                confidence {hoveredEdge.confidence.toFixed(2)} · {hoveredEdge.relationSource}
              </div>
            </div>
          )}
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
                      <div className="font-medium">{edge.label}</div>
                      <div className="text-xs text-neutral-500">{edge.shortDescription}</div>
                    </button>
                  ))}
                  {!selectedPaperEdges.length && (
                    <div className="text-sm text-neutral-500">No connected edges yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selected?.kind === "edge" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.edge.label}</h2>
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
                  <DetailBlock label="Short Description" value={selected.edge.shortDescription} />
                  <DetailBlock label="Long Description" value={selected.edge.longDescription} />
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

      <footer className="h-8 shrink-0 border-t border-neutral-200 bg-white px-4 py-1 text-xs text-neutral-500">
        {status}
      </footer>
    </main>
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
