# Documentation Index

> **이 폴더는 무엇인가요?**
> 협업자를 위한 인수인계 문서 묶음입니다. 무엇이 만들어졌는지, 모듈들이 어떻게 맞물리는지, 데이터가 어떻게 저장되는지, 반드시 지켜야 할 구현 규칙이 무엇인지를 설명합니다.
>
> **다른 폴더와의 관계**
> - 루트 [`README.md`](../README.md)가 빠른 시작 안내라면, 이 폴더는 더 깊은 설계 설명을 담습니다.
> - 각 코드 폴더(`src/app`, `src/components`, `src/lib` 등)의 README로 연결되는 색인 역할도 합니다.

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
7. [../src/lib/EDGE_GENERATION.md](../src/lib/EDGE_GENERATION.md)
   - Candidate scoring, LLM edge policy, validation, merge rules, and configurable settings.

## Module-Level Notes

- [../src/app/README.md](../src/app/README.md)
  - App Router entry points and client/server boundaries.
- [../src/app/api/README.md](../src/app/api/README.md)
  - API route groups and handler rules.
- [../src/components/README.md](../src/components/README.md)
  - React Flow workspace, modals, visual controls, and deletion UX.
- [../src/lib/README.md](../src/lib/README.md)
  - Domain modules, storage boundary, analysis pipeline, and invariants.
- [../src/lib/google-drive/README.md](../src/lib/google-drive/README.md)
  - OAuth, Drive storage, and Drive adapter responsibilities.
- [../scripts/README.md](../scripts/README.md)
  - Local maintenance and demo seeding scripts.

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
- Production can use Gemini or Upstage for LLM analysis, depending on `LLM_PROVIDER`.
- Upstage Document Parse remains the recommended parser for OCR/layout-heavy PDFs.
- Vercel deployments must use Postgres-backed OAuth token/session storage.
- Edge generation settings are project settings for future uploads by default; existing generated edges change only through the explicit Refresh Edges action.
- The graph chatbot never mutates `graph.json` directly; it only returns proposed edge actions that the user must approve.
