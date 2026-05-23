# Documentation Index

This folder is the handoff packet for collaborators. It explains what has been built, how the modules fit together, how data is stored, and which implementation rules must be preserved.

## Read In This Order

1. [HANDOFF.md](./HANDOFF.md)
   - Current status, setup commands, known failure modes, and collaboration notes.
2. [ARCHITECTURE.md](./ARCHITECTURE.md)
   - End-to-end system flow and module responsibilities.
3. [DATA_MODEL.md](./DATA_MODEL.md)
   - `graph.json`, paper nodes, paper edges, suggestions, and merge invariants.
4. [STORAGE_AND_ENV.md](./STORAGE_AND_ENV.md)
   - `.env`, local mode, Google Drive mode, and local data layout.
5. [UI_GRAPH.md](./UI_GRAPH.md)
   - React Flow implementation, node/edge rendering, filters, editing, and current UX details.
6. [API.md](./API.md)
   - Route handlers, request/response contracts, and persistence behavior.

## Non-Negotiable Rules

- Node means paper only.
- Edge means paper-to-paper relationship only.
- Upload analysis must be incremental.
- Existing graph data must be preserved.
- User-edited edges have highest priority.
- LLM conflicts must become suggestions, not destructive updates.
- Local mode uses `local_data/` as the Drive replacement.
- React Flow custom nodes must keep their handles or edges can disappear.
- Deleting a paper node must not delete the original PDF file.
- Production uses Upstage Document Parse and Solar Pro 3 by default.
- Vercel deployments must use Postgres-backed OAuth token/session storage.
