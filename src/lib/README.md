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
  - Extracts text from PDF buffers with either local `pdf-parse` or Upstage Document Parse.
- `llm.ts`
  - LLM prompts, JSON parsing, retry/fallback behavior.
  - Supports Upstage Solar Pro 3 and the previous OpenAI-compatible path.
- `candidates.ts`
  - Lexical candidate scoring for top-k existing papers.
- `graph-validation.ts`
  - Validates and normalizes relation extraction output.
- `merge.ts`
  - Incremental graph merge, edge suggestion rules, edge deletion, and paper node deletion.
- `google-drive/`
  - Google OAuth, auth storage, Drive client, Drive storage adapter.

## Important Invariants

- Do not overwrite user-edited edges.
- Do not regenerate the whole graph for a new upload.
- Keep file/storage details behind `StorageAdapter`.
- Keep React Flow-specific layout data out of `graph.json`.
- Paper node deletion removes graph nodes, connected edges, related suggestions, and saved node position only.
- Original PDF files are intentionally preserved when deleting a paper node.
