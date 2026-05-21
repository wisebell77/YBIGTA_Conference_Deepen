"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Edge,
  type Node,
  type NodeTypes
} from "reactflow";
import PaperNode from "./PaperNode";
import {
  EDGE_STYLE_MAP,
  RELATION_LABELS,
  RELATION_TYPES,
  type EdgeSuggestion,
  type GraphData,
  type PaperEdge,
  type PaperNode as PaperNodeType,
  type RelationType
} from "@/lib/types";

type SelectedItem =
  | { kind: "paper"; paper: PaperNodeType }
  | { kind: "edge"; edge: PaperEdge }
  | null;

type EdgeForm = {
  relationType: RelationType;
  label: string;
  shortDescription: string;
  longDescription: string;
};

const nodeTypes: NodeTypes = { paperNode: PaperNode };

function toReactFlowNodes(graph: GraphData, visibleNodeIds: Set<string>): Node[] {
  return graph.nodes
    .filter((paper) => visibleNodeIds.has(paper.id))
    .map((paper, index) => ({
      id: paper.id,
      type: "paperNode",
      position: {
        x: (index % 5) * 290,
        y: Math.floor(index / 5) * 180
      },
      data: {
        title: paper.title,
        shortSummary: paper.shortSummary,
        paper
      }
    }));
}

function toReactFlowEdges(graph: GraphData, activeRelations: Set<RelationType>): Edge[] {
  return graph.edges
    .filter((edge) => activeRelations.size === 0 || activeRelations.has(edge.relationType))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: false,
      label: edge.label,
      markerEnd: edge.directed ? { type: MarkerType.ArrowClosed } : undefined,
      style: EDGE_STYLE_MAP[edge.relationType],
      data: { edge }
    }));
}

function formatAuthors(authors: string[]) {
  return authors.length ? authors.join(", ") : "Unknown authors";
}

function getPaperTitle(graph: GraphData | null, paperId: string) {
  return graph?.nodes.find((paper) => paper.id === paperId)?.title ?? paperId;
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

  const loadGraph = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/graph`);
    const json = (await response.json()) as { success: boolean; graph: GraphData };
    if (!json.success) throw new Error("GRAPH_LOAD_FAILED");
    setGraph(json.graph);
    setStatus(`Loaded ${json.graph.nodes.length} papers and ${json.graph.edges.length} edges`);
  }, [projectId]);

  useEffect(() => {
    loadGraph().catch((error) => setStatus((error as Error).message));
  }, [loadGraph]);

  const visibleEdges = useMemo(
    () => (graph ? toReactFlowEdges(graph, activeRelations) : []),
    [graph, activeRelations]
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
    () => (graph ? toReactFlowNodes(graph, visibleNodeIds) : []),
    [graph, visibleNodeIds]
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
    setStatus("Edge update saved");
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

      <section className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="min-h-0 border-r border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search papers"
              className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-950"
            />
          </div>
          <div className="h-[calc(100vh-7.5rem)] overflow-auto p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-neutral-500">Paper List</div>
            <div className="space-y-2">
              {filteredPapers.map((paper) => (
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
                <button
                  className="text-xs text-neutral-500 underline"
                  onClick={() => setActiveRelations(new Set())}
                >
                  all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {RELATION_TYPES.map((type) => {
                  const active = activeRelations.has(type);
                  return (
                    <button
                      key={type}
                      className={[
                        "border px-2 py-1 text-left",
                        active
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                      ].join(" ")}
                      onClick={() => toggleRelation(type)}
                    >
                      {RELATION_LABELS[type]}
                    </button>
                  );
                })}
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

        <div className="min-h-0 bg-neutral-50">
          <ReactFlow
            nodes={nodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            fitView
            onNodeClick={(_, node) =>
              setSelected({ kind: "paper", paper: node.data.paper as PaperNodeType })
            }
            onEdgeClick={(_, edge) => {
              setSelected({ kind: "edge", edge: edge.data.edge as PaperEdge });
              setEditing(false);
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
        </div>

        <aside className="min-h-0 overflow-auto border-l border-neutral-200 bg-white p-4">
          <div className="mb-4 text-xs font-semibold uppercase text-neutral-500">Detail Panel</div>
          {!selected && (
            <div className="text-sm text-neutral-500">
              Select a node or edge to inspect graph memory.
            </div>
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
                  <label className="block text-sm">
                    Relation Type
                    <select
                      value={edgeForm.relationType}
                      onChange={(event) => {
                        const relationType = event.target.value as RelationType;
                        setEdgeForm({
                          ...edgeForm,
                          relationType,
                          label: RELATION_LABELS[relationType]
                        });
                      }}
                      className="mt-1 w-full border border-neutral-300 px-2 py-2"
                    >
                      {RELATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {RELATION_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
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

      <footer className="h-8 shrink-0 border-t border-neutral-200 bg-white px-4 py-1 text-xs text-neutral-500">
        {status}
      </footer>
    </main>
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
