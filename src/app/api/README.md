# `src/app/api` Module Notes

> **이 폴더는 무엇인가요?**
> 서버에서만 실행되는 API 라우트 핸들러 모음입니다. 그래프 조회/저장, PDF 업로드·분석, 엣지 편집·새로고침, 관계 제안 수락/거절, 요약 한국어 번역, 그래프 챗봇, Google OAuth를 처리합니다.
>
> **다른 폴더와의 관계**
> - 브라우저 UI([`src/components`](../../components/README.md))의 `fetch` 요청을 받는 입구입니다.
> - 실제 로직은 직접 구현하지 않고 [`src/lib`](../../lib/README.md)(`analyze.ts`, `merge.ts`, `chat.ts`, `llm.ts`, `storage.ts` 등)를 호출합니다.
> - 저장소 접근은 항상 `getStorageAdapter()`를 통해서만 하므로, 로컬/Google Drive 모드가 라우트 코드에는 드러나지 않습니다.
> - API 키·OAuth 토큰은 이 서버 경계 밖(브라우저)으로 절대 나가지 않습니다.

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
  - Translates a paper summary to Korean and caches it in `graph.json` (`papers/[fileId]/translate-summary`). Re-requesting a paper that already has a cached Korean summary returns it without calling the LLM again.
- `projects/[projectId]/edges/*`
  - Creates, edits, and deletes user-controlled edges.
  - Refreshes generated edges through `POST /api/projects/:projectId/edges/refresh`.
- `projects/[projectId]/edge-suggestions/*`
  - Accepts or rejects LLM-generated suggestions.
- `projects/[projectId]/chat`
  - Graph-aware chatbot endpoint. Reads the current `graph.json`, calls `src/lib/chat.ts`, and returns a Korean answer plus optional proposed edge actions.
  - It never mutates the graph itself. Proposed `update_edge` / `create_edge` actions are returned for the UI to apply only after the user approves them.

## Handler Rules

- Keep handlers small. Move business logic to `src/lib`.
- Always use `getStorageAdapter()` instead of direct filesystem or Drive calls.
- Preserve existing graph data when writing.
- Validate external IDs before mutating graph data.
- Return stable JSON envelopes such as `{ "success": true, ... }` or `{ "success": false, "error": "..." }`.
- Do not expose API keys, OAuth tokens, or raw provider errors to the browser.


## Manual Edge Refresh Contract

`POST /api/projects/:projectId/edges/refresh` is the explicit path for applying current `analysisSettings` to existing papers. It preserves user-created and user-edited edges, removes generated edges, clears suggestions, recomputes generated relations with the configured LLM, writes `graph.json`, and returns refresh stats.
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
