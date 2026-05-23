# UI And Graph Rendering

The main UI is implemented in:

```text
src/components/GraphWorkspace.tsx
src/components/PaperNode.tsx
src/app/globals.css
```

## Layout

The page has:

- top bar
- left sidebar
- graph canvas
- right detail panel
- bottom status bar

Left and right panels are resizable. Their font size increases as the panel gets wider.

## Paper Nodes

`PaperNode.tsx` renders a custom React Flow node.

Supported display modes:

- square node
- circle node

The left sidebar has a node shape toggle.

Important React Flow rule:

Custom nodes must expose handles for edges.

Current node handles:

- target handle on the left
- source handle on the right

If these are removed or hidden incorrectly, edges can disappear.

## Edges

Edges are rendered by the custom edge component:

```text
PaperRelationEdge
```

Defined in:

```text
src/components/GraphWorkspace.tsx
```

Current behavior:

- relation label is shown in a small pill above the edge line
- edge line uses relation-specific grayscale/dark accent color
- confidence controls opacity and line strength
- directed edges use a small SVG marker arrow
- hover shows a floating explanation panel
- click opens the edge detail panel
- detail panel can delete an edge after confirmation
- dragging from one paper node handle to another creates a user-defined edge immediately
- edge paths use curved quadratic paths with per-edge offsets so dense labels and parallel edges separate better
- label placement uses an offset normal to the curved path instead of sitting directly on the line
- edge labels can be hidden from the settings panel when the graph becomes dense

## Edge Labels

Before hover:

- the graph shows only a compact relation label

On hover:

- the graph shows detailed reason/description
- confidence and relation source are shown

This keeps the canvas readable while preserving LLM rationale.

## Relation Filters And Colors

Relation filters are in the left sidebar.

Behavior:

- no active filters means show all relation types
- selecting relation types filters edges
- visible nodes are derived from visible edges when filters are active
- `custom` relation exists for user-defined edges
- each relation filter row also includes its edge color picker
- each relation filter row also includes its line style picker: solid, dashed, dotted
- color changes are saved into `graph.json` under `uiSettings.edgeColors`
- line style changes are saved into `graph.json` under `uiSettings.edgeLineStyles`

## Settings Panel

The previous standalone node shape section is now a compact `설정` panel.

Settings:

- node shape: square or circle
- edge label visibility: hide labels when they overlap in dense graphs
- free move mode: enables React Flow node dragging
- node position reset: clears saved node coordinates

When free move mode is enabled, dragging a node saves its final position into `graph.json` under `uiSettings.nodePositions`.

## Edge Editing

Clicking an edge opens the right detail panel.

Editable fields:

- `relationType`
- `label`
- `shortDescription`
- `longDescription`

Immutable fields:

- `id`
- `source`
- `target`
- `createdAt`

Saving an edit calls:

```http
PATCH /api/projects/:projectId/edges/:edgeId
```

The server sets:

```ts
userEdited = true
relationSource = "user_edited"
updatedAt = now
```

## User-Defined Edges

The left sidebar has a create edge action.

It calls:

```http
POST /api/projects/:projectId/edges
```

The server creates a permanent graph edge with:

```ts
relationType = "custom" // default
relationSource = "user_created"
userEdited = true
llmGenerated = false
```

Users can also create an edge by dragging from a source handle to another paper. The UI immediately saves a `custom` edge, selects it, and opens the right panel in edit mode so the relation type, label, and descriptions can be corrected.

## Paper Deletion And Duplicate Warnings

Clicking a paper opens the right detail panel. The panel includes a destructive
`Delete Paper Node` action. It removes the paper from `graph.json` along with
connected edges and related suggestions, but it does not delete the original PDF
from local storage or Google Drive.

Before upload, the UI checks the current graph for a paper with the same original
filename or a title matching the PDF filename without `.pdf`. If a likely
duplicate exists, the user must confirm before upload continues.

## Google Drive Session

When Google Drive is connected, the header shows the connected email and a
`Logout` button. Logout clears the local app session cookie; it does not delete
Drive files, graph data, or stored OAuth tokens.

## Large Paper Lists

The left sidebar intentionally shows only the first 10 visible papers. For large projects, the `more` button opens a modal browser with every currently visible paper.

This keeps the sidebar usable even if the graph grows to thousands of papers.

## Suggestions

Pending suggestions are shown in the left sidebar.

Actions:

- accept
- reject

These call the suggestion API routes and persist the graph.

## Design Rules

- Monochrome and grayscale first.
- Avoid saturated color-heavy UI.
- Node/edge information should be readable without crowding the canvas.
- Keep edge labels compact.
- Use hover/detail panel for long explanations.
