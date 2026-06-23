# `src/lib` Module Notes

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
