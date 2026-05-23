# `src/components` Module Notes

This folder contains the interactive graph UI.

## `GraphWorkspace.tsx`

Main client component.

Responsibilities:

- load graph
- upload PDFs
- connect Google Drive
- render React Flow
- convert `GraphData` into React Flow nodes/edges
- filter by relation type
- resize side panels
- toggle square/circle node mode
- show edge hover explanations
- edit existing edges
- create user-defined edges
- create user-defined edges by dragging between React Flow handles
- configure relation edge colors from the left sidebar
- hide/show edge label pills from the settings panel
- toggle node free-move mode and persist node positions
- accept/reject suggestions

Important custom edge pieces:

- `PaperRelationEdge`
- `edgeTypes`
- `toReactFlowEdges`
- `confidenceStyle`
- `createEdgeByDrag`
- `relationColors`
- `saveUiSettings`
- `saveNodePosition`
- `resetNodePositions`
- `relationLineStyles`

## Dense Graph Label Strategy

Edge labels are useful in small graphs but become noisy in dense graphs.

Current mitigation:

- labels are rendered with `EdgeLabelRenderer` in the DOM layer
- edge paths are custom quadratic curves rather than straight lines
- parallel and nearby edges get different curve offsets
- label position is offset away from the curved edge using a perpendicular normal
- labels can be hidden globally from `설정`
- relation color and line style remain visible even when labels are hidden

## `PaperNode.tsx`

Custom paper node.

Important: React Flow custom nodes need handles for edges to render correctly.

Current handles:

- target handle on the left
- source handle on the right

Do not remove those handles unless the edge rendering strategy is replaced.
