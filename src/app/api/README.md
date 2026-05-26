# `src/app/api` Module Notes

This folder contains server-only route handlers. These routes are the boundary between the browser UI and the graph/PDF/storage logic in `src/lib`.

## Route Groups

- `auth/google/*`
  - Starts Google OAuth, handles the callback, reports connection status, and logs out.
  - Uses `src/lib/google-drive/auth.ts` and `auth-store.ts`.
- `projects/[projectId]/graph`
  - Reads graph state.
  - Persists UI settings and analysis settings to `graph.json`.
- `projects/[projectId]/papers/*`
  - Uploads PDFs.
  - Supports direct local uploads and Google Drive chunked uploads.
  - Runs paper analysis after upload.
  - Reads existing PDF files.
  - Deletes paper nodes from graph memory without deleting source PDFs.
- `projects/[projectId]/edges/*`
  - Creates, edits, and deletes user-controlled edges.
- `projects/[projectId]/edge-suggestions/*`
  - Accepts or rejects LLM-generated suggestions.

## Handler Rules

- Keep handlers small. Move business logic to `src/lib`.
- Always use `getStorageAdapter()` instead of direct filesystem or Drive calls.
- Preserve existing graph data when writing.
- Validate external IDs before mutating graph data.
- Return stable JSON envelopes such as `{ "success": true, ... }` or `{ "success": false, "error": "..." }`.
- Do not expose API keys, OAuth tokens, or raw provider errors to the browser.

## Settings Persistence

`PATCH /api/projects/:projectId/graph` is the shared settings persistence route.

It accepts:

- `uiSettings`: visual graph preferences such as edge colors, line styles, label visibility, node shape, free-move mode, and node positions.
- `analysisSettings`: automatic edge generation policy such as candidate scoring weights, confidence thresholds, and custom prompt instructions.

Both are stored inside the active project's `graph.json`, so they persist in local mode and Google Drive mode.

## Upload Analysis Contract

All upload paths eventually call the same analysis pipeline:

```text
save/read PDF
-> extract text
-> extract metadata and summary
-> select candidate papers
-> extract relations
-> validate relation output
-> merge into graph
-> write graph
```

New edge generation settings are read at analysis time and apply only to the newly uploaded paper.
