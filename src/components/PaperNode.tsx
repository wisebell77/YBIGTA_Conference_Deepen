"use client";

import type { NodeProps } from "reactflow";
import type { PaperNode as PaperNodeData } from "@/lib/types";

export default function PaperNode({
  data,
  selected
}: NodeProps<{ title: string; shortSummary: string; paper: PaperNodeData }>) {
  return (
    <div
      title={data.shortSummary}
      className={[
        "w-60 border bg-white px-3 py-2 text-neutral-950 shadow-sm",
        selected ? "border-neutral-950" : "border-neutral-300"
      ].join(" ")}
    >
      <div className="line-clamp-3 text-sm font-semibold leading-snug">{data.title}</div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
        <span>{data.paper.year ?? "연도 미상"}</span>
        <span>{data.paper.keywords.slice(0, 2).join(" / ")}</span>
      </div>
    </div>
  );
}
