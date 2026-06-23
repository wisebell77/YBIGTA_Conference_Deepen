# YBIGTA Conference Deepen

Paper Graph Memory is a Next.js app that turns uploaded research PDFs into a persistent paper-to-paper graph.

The core product is an incremental graph memory system:

```text
new PDF
-> extract paper text
-> create paper metadata and summary
-> compare with existing graph memory
-> select candidate papers
-> extract paper-to-paper relations
-> merge into graph.json without overwriting user edits
```

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- React Flow for graph rendering
- `pdf-parse` local PDF extraction
- Upstage Document Parse for OCR/layout-heavy PDF extraction
- Gemini, Upstage Solar, or OpenAI-compatible chat models for LLM analysis
- Local JSON/PDF storage or Google Drive storage
- Optional Postgres-backed OAuth token/session storage for shared deployments

## Quick Start

```bash
npm ci
npm run seed:local
npm run dev
```

Open:

```text
http://localhost:3000
```

Use `.env` for local secrets and `.env.example` as the public template. Never commit real API keys.

## Provider Modes

Gemini mode:

```env
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=...
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

Upstage mode:

```env
LLM_PROVIDER=upstage
LLM_MODEL=solar-pro3
UPSTAGE_API_KEY=...
UPSTAGE_BASE_URL=https://api.upstage.ai/v1
```

OpenAI-compatible comparison mode:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
```

PDF extraction can be selected independently:

```env
PDF_TEXT_PROVIDER=local
PDF_TEXT_PROVIDER=upstage
```

## Storage Modes

Local mode:

```env
STORAGE_BACKEND=local
LOCAL_STORAGE_ROOT=./local_data
```

Google Drive mode:

```env
STORAGE_BACKEND=google_drive
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Project data is persisted in `graph.json`. That file stores paper nodes, paper edges, suggestions, UI preferences, and edge generation settings.

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

Copies demo PDFs from `../data_papers` into `local_data/projects/demo-project/papers` and creates a demo `graph.json`.

## Core Rules

- A node is always a paper.
- An edge is always a paper-to-paper relationship.
- New uploads use incremental graph updates, not full graph regeneration.
- Existing edges are preserved.
- `userEdited=true` edges are never overwritten by LLM output.
- Conflicting LLM output becomes an `edgeSuggestion`.
- User-created and user-edited edges are permanently saved to `graph.json`.
- Deleting a paper removes only graph memory for that paper and connected edges; original PDFs are preserved.
- Duplicate-looking uploads warn before analysis instead of silently creating another node.
- React Flow custom nodes must keep source/target handles or edges can disappear.
- UI preferences and edge generation settings are persisted in `graph.json`.
- Edge generation settings apply to future uploads by default; use Refresh Edges to recalculate existing generated edges with the current policy while preserving user-created and user-edited edges.

## Project Map

```text
src/app/                  Next.js app entry and route handlers
src/app/api/              API routes for graph, papers, edges, OAuth
src/components/           React Flow workspace and paper node UI
src/lib/types.ts          GraphData, PaperNode, PaperEdge, settings, constants
src/lib/storage.ts        StorageAdapter selection and local storage
src/lib/google-drive/     Google OAuth and Drive-backed storage adapter
src/lib/pdf.ts            PDF text extraction
src/lib/llm.ts            Provider calls, prompts, JSON parsing, fallback behavior
src/lib/candidates.ts     Candidate paper lexical scoring
src/lib/graph-validation.ts
                          Validation and normalization of LLM relation output
src/lib/merge.ts          Incremental merge rules
src/lib/analyze.ts        End-to-end upload analysis pipeline
src/lib/refresh-edges.ts  Manual generated-edge refresh pipeline for existing graphs
scripts/                  Local maintenance and demo seeding scripts
docs/                     Handoff and architecture documentation
```

## Module READMEs

- [src/app/README.md](./src/app/README.md)
- [src/app/api/README.md](./src/app/api/README.md)
- [src/components/README.md](./src/components/README.md)
- [src/lib/README.md](./src/lib/README.md)
- [src/lib/google-drive/README.md](./src/lib/google-drive/README.md)
- [scripts/README.md](./scripts/README.md)

## Documentation

Start here:

- [docs/README.md](./docs/README.md)
- [docs/HANDOFF.md](./docs/HANDOFF.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md)
- [docs/STORAGE_AND_ENV.md](./docs/STORAGE_AND_ENV.md)
- [docs/UI_GRAPH.md](./docs/UI_GRAPH.md)
- [docs/API.md](./docs/API.md)
- [src/lib/EDGE_GENERATION.md](./src/lib/EDGE_GENERATION.md)

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

Check [src/components/PaperNode.tsx](./src/components/PaperNode.tsx). Custom React Flow nodes need `Handle` components for edge attachment.
