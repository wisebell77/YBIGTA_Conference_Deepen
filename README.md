# YBIGTA Conference Deepen

Paper Graph Memory is a Next.js app that turns uploaded research PDFs into a persistent paper-to-paper graph.

The important product idea is not a one-off PDF summarizer. It is an incremental graph memory system:

```text
new PDF
-> new paper metadata and summary
-> compare with existing graph memory
-> select candidate papers
-> extract relations
-> merge into graph.json without overwriting user edits
```

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- React Flow
- pdf-parse
- Upstage Document Parse
- Upstage Solar Pro 3
- OpenAI-compatible LLM calls
- Local JSON/PDF storage
- Google Drive storage adapter
- Postgres-backed OAuth token/session storage for deployment

## Quick Start

Install dependencies from the lockfile:

```bash
npm ci
```

Use local storage mode while Google Drive is not ready:

```env
STORAGE_BACKEND=local
LOCAL_STORAGE_ROOT=./local_data
```

Seed local demo data from `../data_papers`:

```bash
npm run seed:local
```

Run the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Files

Use `.env` for the running app.

Use `.env.example` only as the shared template. Do not put real secrets in `.env.example`.

Minimal local development config:

```env
LLM_PROVIDER=upstage
UPSTAGE_API_KEY=
UPSTAGE_BASE_URL=https://api.upstage.ai/v1
LLM_MODEL=solar-pro3
PDF_TEXT_PROVIDER=upstage
PDF_TEXT_FALLBACK_TO_LOCAL=true
UPSTAGE_DOCUMENT_PARSE_OUTPUT_FORMAT=markdown
MAX_UPLOAD_MB=20
STORAGE_BACKEND=local
LOCAL_STORAGE_ROOT=./local_data
GOOGLE_AUTH_FILE=./local_data/tokens/google-auth.json
```

When Google Drive is enabled:

```env
STORAGE_BACKEND=google_drive
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

For Vercel production, also set:

```env
DATABASE_URL=postgresql://...
DATABASE_SSL=true
GOOGLE_REDIRECT_URI=https://your-domain/api/auth/google/callback
```

## Scripts

```bash
npm run dev
```

Deletes stale `.next` output and starts the Next.js dev server.

```bash
npm run build
```

Deletes stale `.next` output and builds production output.

```bash
npm run typecheck
```

Generates Next.js route types and runs TypeScript.

```bash
npm run lint
```

Runs ESLint.

```bash
npm run seed:local
```

Copies PDFs from `../data_papers` into `local_data/projects/demo-project/papers` and creates a demo `graph.json`.

## Local Data Layout

```text
local_data/
  projects/
    demo-project/
      papers/
        file_*.pdf
      cache/
        graph.json
        graph.json.bak
  tokens/
    google-auth.json
```

`local_data/`, `.env`, `.next/`, and `node_modules/` are local-only and should not be committed.

## Main API

- `GET /api/projects/:projectId/graph`
- `POST /api/projects/:projectId/papers/upload`
- `POST /api/projects/:projectId/papers/drive-upload-session`
- `POST /api/projects/:projectId/papers/analyze-drive-file`
- `GET /api/projects/:projectId/papers/:fileId`
- `DELETE /api/projects/:projectId/papers/:fileId`
- `POST /api/projects/:projectId/edges`
- `PATCH /api/projects/:projectId/edges/:edgeId`
- `DELETE /api/projects/:projectId/edges/:edgeId`
- `POST /api/projects/:projectId/edge-suggestions/:suggestionId/accept`
- `POST /api/projects/:projectId/edge-suggestions/:suggestionId/reject`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/auth/google/status`
- `POST /api/auth/google/logout`

## Core Rules

- A node is always a paper.
- An edge is always a paper-to-paper relationship.
- Semantic relationships are allowed even without direct citation evidence.
- New uploads must use incremental graph update, not full regeneration.
- Existing edges are preserved.
- `userEdited=true` edges must never be overwritten by LLM output.
- Conflicting LLM output becomes an `edgeSuggestion`.
- User-created or user-edited edges are permanently saved to `graph.json`.
- Deleting a paper removes only graph memory for that paper and connected edges; original PDFs are preserved.
- Duplicate-looking uploads should warn before analysis instead of silently creating another node.
- UI stays grayscale/monochrome first.
- React Flow requires source/target handles on custom nodes; removing them can make edges disappear.
- Edge colors, line styles, node shape, edge label visibility, free-move mode, and node positions are persisted in `graph.json` under `uiSettings`.
- For dense graphs, the sidebar shows 10 papers first and opens a full paper browser modal for the rest.

## Project Map

```text
src/app/                  Next.js App Router pages and API routes
src/components/           React Flow workspace and paper node UI
src/lib/types.ts          GraphData, PaperNode, PaperEdge, constants
src/lib/storage.ts        StorageAdapter and local storage implementation
src/lib/google-drive/     Google OAuth and Drive-backed storage adapter
src/lib/pdf.ts            PDF text extraction
src/lib/llm.ts            LLM JSON extraction and local fallback behavior
src/lib/candidates.ts     Candidate paper lexical scoring
src/lib/graph-validation.ts
                          Validation and normalization of LLM relation output
src/lib/merge.ts          Incremental merge rules
src/lib/analyze.ts        End-to-end upload analysis pipeline
scripts/seed-local-data.mjs
                          Local demo graph generator
scripts/clean-next.mjs    Removes stale .next build output
docs/                     Handoff and architecture documentation
```

## Documentation

Start here:

- [docs/README.md](./docs/README.md)
- [docs/HANDOFF.md](./docs/HANDOFF.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md)
- [docs/STORAGE_AND_ENV.md](./docs/STORAGE_AND_ENV.md)
- [docs/UI_GRAPH.md](./docs/UI_GRAPH.md)
- [docs/API.md](./docs/API.md)

## Common Problems

### `Cannot find module './611.js'`

This is usually stale `.next` output.

```bash
npm run clean
npm run dev
```

`dev` and `build` already run `clean` first.

### `Cannot find module 'pg'`

Dependencies are out of sync with `package-lock.json`.

```bash
npm ci
```

### Edges do not show in React Flow

Check `src/components/PaperNode.tsx`. Custom React Flow nodes need `Handle` components for edge attachment. The current node exposes a target handle on the left and a source handle on the right.
