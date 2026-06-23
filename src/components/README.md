# `src/components` Module Notes

This folder contains the interactive graph UI. Components here should call API routes and render state, but should not duplicate domain merge or analysis logic from `src/lib`.

## `GraphWorkspace.tsx`

Main client component.

Responsibilities:

- load graph data;
- upload PDFs;
- connect Google Drive;
- log out from the local Google Drive session;
- render React Flow;
- convert `GraphData` into React Flow nodes/edges;
- filter by relation type;
- resize side panels;
- toggle square/circle node mode;
- show edge hover explanations;
- show the Korean help modal from the bottom-right `도움말` button;
- edit existing edges;
- delete edges;
- delete paper nodes from graph memory without deleting source PDFs;
- create user-defined edges;
- create user-defined edges by dragging between React Flow handles;
- configure relation edge colors from the left sidebar;
- hide/show edge label pills from the settings panel;
- configure automatic edge generation from the settings detail modal;
- refresh existing generated edges from the current edge generation settings;
- toggle node free-move mode and persist node positions;
- accept/reject suggestions;
- warn before uploading a likely duplicate PDF.

Important pieces:

- `PaperRelationEdge`
- `edgeTypes`
- `toReactFlowEdges`
- `confidenceStyle`
- `createEdgeByDrag`
- `relationColors`
- `saveUiSettings`
- `saveNodePosition`
- `refreshGeneratedEdges`
- `flowNodes` / `onNodesChange`
- `resetNodePositions`
- `relationLineStyles`
- `findPotentialDuplicate`
- `AnalysisSettingsModal`
- `HelpModal`
- `deleteSelectedPaper`
- `deleteSelectedEdge`

## Dense Graph Label Strategy

Edge labels are useful in small graphs but become noisy in dense graphs.

Current mitigation:

- labels are rendered with `EdgeLabelRenderer` in the DOM layer;
- edge paths are custom quadratic curves rather than straight lines;
- parallel and nearby edges get different curve offsets;
- label position is offset away from the curved edge using a perpendicular normal;
- labels can be hidden globally from Settings;
- relation color and line style remain visible even when labels are hidden.

## Settings UX

The left sidebar stores two categories of persistent settings:

- visual settings in `uiSettings`;
- automatic edge generation settings in `analysisSettings`.

Both are saved through:

```text
PATCH /api/projects/:projectId/graph
```

`analysisSettings` is applied automatically during future upload analysis. Changing it should not mutate existing graph data unless the user explicitly clicks Refresh Edges, which recomputes generated edges while preserving user-controlled edges.

## Help UX

The bottom-right `도움말` button opens a centered modal with Korean explanations for the app's major features. The same modal can be opened with the `#help` URL hash.

Keep the copy user-facing and avoid leaking internal provider details or secrets.

## `PaperNode.tsx`

Custom paper node.

Important: React Flow custom nodes need handles for edges to render correctly.

Current handles:

- target handle on the left;
- source handle on the right.

Do not remove those handles unless the edge rendering strategy is replaced.

## Deletion UX

Deleting an edge or paper uses a browser confirmation dialog before calling the API.

Paper deletion removes the node, connected edges, related suggestions, and saved node position from `graph.json`. The original PDF remains in local storage or Google Drive.
