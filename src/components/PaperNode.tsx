"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import type { PaperNode as PaperNodeData } from "@/lib/types";

function NodeHandles() {
  return (
    <>
      <Handle className="paper-node-handle" type="target" position={Position.Left} />
      <Handle className="paper-node-handle" type="source" position={Position.Right} />
    </>
  );
}

export default function PaperNode({
  data,
  selected
}: NodeProps<{
  title: string;
  shortSummary: string;
  paper: PaperNodeData;
  shapeMode: "square" | "circle";
}>) {
  if (data.shapeMode === "circle") {
    return (
      <div
        title={data.shortSummary}
        className={[
          "relative flex h-28 w-28 items-center justify-center rounded-full border bg-white p-3 text-center text-neutral-950 shadow-sm",
          selected ? "border-2 border-neutral-950" : "border-neutral-300"
        ].join(" ")}
      >
        <NodeHandles />
        <div>
          <div className="line-clamp-3 text-xs font-semibold leading-snug">{data.title}</div>
          <div className="mt-1 text-[10px] text-neutral-500">{data.paper.year ?? ""}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      title={data.shortSummary}
      className={[
        "relative w-64 border bg-white px-4 py-3 text-neutral-950 shadow-sm",
        selected ? "border-neutral-950" : "border-neutral-300"
      ].join(" ")}
    >
      <NodeHandles />
      <div className="line-clamp-3 text-base font-semibold leading-snug">{data.title}</div>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{data.paper.year ?? "연도 미상"}</span>
        <span>{data.paper.keywords.slice(0, 2).join(" / ")}</span>
      </div>
    </div>
  );
}
