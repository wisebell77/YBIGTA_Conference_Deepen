# `src/lib` Module Notes

This folder contains domain logic and server-side helpers. UI components should not reimplement this logic.

## Files

- `types.ts`
  - Domain types, relation enums, labels, style constants, default analysis settings, `StorageAdapter`.
- `storage.ts`
  - Selects local vs Google Drive storage.
  - Implements local `graph.json` and PDF persistence.
  - Creates `graph.json.bak` before graph writes.
- `analyze.ts`
  - End-to-end PDF upload analysis pipeline.
- `pdf.ts`
  - Extracts text from PDF buffers.
- `llm.ts`
  - LLM prompts, JSON parsing, retry/fallback behavior.
- `candidates.ts`
  - Lexical candidate scoring for top-k existing papers.
- `graph-validation.ts`
  - Validates and normalizes relation extraction output.
- `merge.ts`
  - Incremental graph merge and edge suggestion rules.
- `google-drive/`
  - Google OAuth, auth storage, Drive client, Drive storage adapter.

## Important Invariants

- Do not overwrite user-edited edges.
- Do not regenerate the whole graph for a new upload.
- Keep file/storage details behind `StorageAdapter`.
- Keep React Flow-specific layout data out of `graph.json`.
