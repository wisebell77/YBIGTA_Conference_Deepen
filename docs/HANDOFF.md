# Handoff Notes

## Current Status

This repository contains a working MVP of a paper graph memory app.

Implemented features:

- PDF upload
- PDF text extraction with `pdf-parse`
- LLM metadata and summary extraction
- Candidate paper selection against existing graph memory
- LLM relation extraction for candidate pairs only
- Incremental graph merge
- Local JSON/PDF storage
- Google Drive storage adapter and OAuth flow skeleton
- React Flow graph UI
- Paper list and relation filters
- Resizable left and right panels
- Square/circle paper node display modes
- Visible directed paper-to-paper edges
- Edge hover explanation
- Edge detail panel
- Edge editing with permanent persistence
- Edge deletion with permanent persistence
- User-defined edge creation
- User-defined edge creation by dragging between node handles
- Paper node deletion from graph memory without deleting source PDFs
- Duplicate upload warning by filename/title
- Google Drive logout button
- Relation filter rows with color and line-style controls
- Persisted graph UI settings in `graph.json`
- Optional edge-label hiding for dense graphs
- Curved edge paths with per-edge offsets for denser graphs
- Free-move mode with real-time dragging and persisted final node positions
- Node position reset
- Large paper-list modal after the first 10 sidebar papers
- Edge suggestion accept/reject endpoints
- Local seed data generation from `../data_papers`
- Upstage Document Parse PDF text extraction
- Gemini metadata/summary/relation extraction through Google AI Studio's OpenAI-compatible API
- Upstage Solar Pro 3 metadata/summary/relation extraction
- Project-level edge generation settings persisted in `graph.json`
- Manual Refresh Edges action that recomputes generated edges from current `analysisSettings` while preserving user-created and user-edited edges
- Korean help modal opened from the bottom-right `도움말` button
- Graph-aware chatbot (`챗봇` button) that reads graph context and answers in Korean; it can propose edge updates/creations that are applied only after explicit user approval
- On-demand Korean translation of a paper's English summary, cached in `graph.json`

## First Setup On Another PC

```bash
npm ci
```

Optional local demo data:

```bash
npm run seed:local
```

Start development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Verify:

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment Rule

The app reads `.env`.

`.env.example` is only a template for teammates. Do not store real secrets there.

Recommended local mode:

```env
STORAGE_BACKEND=local
LOCAL_STORAGE_ROOT=./local_data
```

Use Google Drive mode only when OAuth and Drive access are ready:

```env
STORAGE_BACKEND=google_drive
DATABASE_URL=...
DATABASE_SSL=true
```

LLM provider is selected independently:

```env
LLM_PROVIDER=gemini
LLM_PROVIDER=upstage
LLM_PROVIDER=openai
```

PDF extraction is also selected independently:

```env
PDF_TEXT_PROVIDER=local
PDF_TEXT_PROVIDER=upstage
```

## Local Demo Data

`npm run seed:local` reads PDFs from:

```text
../data_papers
```

It writes:

```text
local_data/
  projects/
    demo-project/
      papers/
      cache/
        graph.json
```

The seeded graph is meant to let the UI show real paper nodes and edges without Google Drive.

## Frequent Problems

### Stale Next.js chunk error

Example:

```text
Cannot find module './611.js'
```

Fix:

```bash
npm run clean
npm run dev
```

### Missing dependency

Example:

```text
Cannot find module 'pg'
```

Fix:

```bash
npm ci
```

Do not rely on a manually modified `node_modules` folder from another machine.

### Edges disappear

The custom React Flow node must expose handles. Check:

```text
src/components/PaperNode.tsx
```

It must include:

- target handle on the left
- source handle on the right

The graph edge renderer is custom:

```text
src/components/GraphWorkspace.tsx
```

Look for:

- `PaperRelationEdge`
- `edgeTypes`
- `toReactFlowEdges`

## Development Rules

- Preserve `graph.json` whenever possible.
- Do not regenerate the full graph on upload.
- Do not overwrite `userEdited=true` edges.
- Store conflicting LLM output in `edgeSuggestions`.
- Keep storage access behind `StorageAdapter`.
- Keep API writes responsible for persistence.
- Keep local data and real secrets out of git.
- Keep original PDFs when deleting graph paper nodes unless product requirements change.
- Store graph UI preferences in `GraphData.uiSettings`, not in component-only state.
- Store edge generation policy in `GraphData.analysisSettings`.
- Treat `analysisSettings` changes as future-upload policy by default; only the explicit Refresh Edges action should recompute existing generated edges, and it must preserve user-controlled edges.
- Use the dense graph controls before changing the domain data model: hide edge labels, tune line styles, move nodes, or reset positions.
