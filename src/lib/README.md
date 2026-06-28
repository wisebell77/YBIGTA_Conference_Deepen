# `src/lib` Module Notes

> **이 폴더는 무엇인가요?**
> 앱의 핵심 도메인 로직이 모이는 곳입니다. 저장소 선택, PDF 텍스트 추출, LLM 호출, 후보 논문 선별, 관계 검증, 그래프 병합, 수동 엣지 새로고침, 그래프 챗봇이 모두 여기 있습니다.
>
> **다른 폴더와의 관계**
> - [`src/app/api`](../app/api/README.md)의 라우트 핸들러들이 이 폴더의 함수를 호출합니다(예: `analyze.ts`, `merge.ts`, `chat.ts`, `storage.ts`).
> - 파일/Drive 같은 저장소 세부사항은 `StorageAdapter` 뒤로 숨겨집니다. Google Drive 구현은 하위 폴더 [`google-drive/`](./google-drive/README.md)에 있습니다.
> - UI([`src/components`](../components/README.md))는 이 폴더를 직접 import하지 않고, `types.ts`의 타입/상수만 공유한 뒤 API를 통해 호출합니다.
> - API 키와 OAuth 토큰은 이 서버 계층 안에서만 사용됩니다.

This folder contains domain logic and server-side helpers. UI components and route handlers should call into this layer instead of reimplementing graph, storage, PDF, or LLM behavior.

## Files

- `types.ts`
  - Domain types, relation enums, labels, style constants, default UI settings, default analysis settings, and `StorageAdapter`.
- `storage.ts`
  - Selects local vs Google Drive storage.
  - Implements local `graph.json` and PDF persistence.
  - Creates `graph.json.bak` before graph writes.
  - Hydrates missing defaults in older graph files.
- `analyze.ts`
  - End-to-end PDF upload analysis pipeline.
  - Reads project `analysisSettings` before candidate selection and relation extraction.
- `refresh-edges.ts`
  - Manual generated-edge refresh for existing graphs.
  - Preserves user-controlled edges and reuses candidate selection, LLM relation extraction, and merge rules.
- `pdf.ts`
  - Extracts text from PDF buffers with either local `pdf-parse` or Upstage Document Parse.
- `llm.ts`
  - LLM prompts, provider calls, JSON parsing, retry/fallback behavior.
  - Supports Gemini, Upstage Solar, and OpenAI-compatible mode.
  - Appends `analysisSettings.customEdgePrompt` to relation extraction.
  - Also exposes `translatePaperSummaryToKorean`, used by the summary translation route.
- `chat.ts`
  - Graph-aware chatbot logic. Builds a read-only graph context (papers, edges, pending suggestions) and asks the LLM for a Korean answer plus optional proposed edge actions.
  - Never mutates the graph. It only returns `update_edge` / `create_edge` proposals for the UI to apply after user approval.
- `candidates.ts`
  - Weighted lexical candidate scoring for top-k existing papers.
  - Uses title, keyword, and summary overlap.
- `graph-validation.ts`
  - Validates and normalizes relation extraction output.
- `merge.ts`
  - Incremental graph merge, edge suggestion rules, edge deletion, and paper node deletion.
- `EDGE_GENERATION.md`
  - Documents automatic edge generation logic and configurable analysis settings.
- `google-drive/`
  - Google OAuth, auth storage, Drive client, Drive storage adapter.

## Analysis Pipeline

```text
save PDF
-> extract text
-> extract metadata and summary
-> read/create graph
-> read project analysisSettings
-> select candidate papers
-> extract relations with LLM
-> validate relation output
-> merge without overwriting user edits
-> write graph
```


## Manual Refresh Pipeline

```text
read graph
-> keep user-created/user-edited edges
-> remove generated edges and suggestions
-> replay existing papers in createdAt order
-> read project analysisSettings
-> select candidate papers from the replayed set
-> extract relations with LLM
-> merge without overwriting user edits
-> write graph
```
## Important Invariants

- Do not overwrite user-edited edges.
- Do not regenerate the whole graph for a new upload.
- Keep file/storage details behind `StorageAdapter`.
- Keep provider keys and OAuth tokens on the server.
- Do not store raw React Flow objects in `graph.json`.
- Paper node deletion removes graph nodes, connected edges, related suggestions, and saved node position only.
- Original PDF files are intentionally preserved when deleting a paper node.
- `analysisSettings` changes affect future uploads by default; existing generated edges change only through explicit refresh, which must preserve user-created and user-edited edges.

## Where To Change Things

- Add a new LLM provider in `llm.ts`.
- Add a new PDF parser in `pdf.ts`.
- Add a new storage backend by implementing `StorageAdapter`.
- Change automatic edge rules in `EDGE_GENERATION.md`, `types.ts`, `candidates.ts`, `llm.ts`, `merge.ts`, and `refresh-edges.ts`.
- Change graph mutation safety rules in `merge.ts` and `graph-validation.ts`.
