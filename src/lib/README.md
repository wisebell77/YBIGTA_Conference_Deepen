# lib

Core business logic shared by route handlers. This is where most non-UI behavior should live.

Key files:

- `types.ts`: graph schema, relation enums, labels, style constants, and storage adapter interface
- `storage.ts`: storage adapter selection and local storage implementation
- `analyze.ts`: upload analysis pipeline orchestration
- `pdf.ts`: PDF text extraction
- `llm.ts`: metadata and relation extraction prompts/fallbacks
- `candidates.ts`: candidate paper selection
- `merge.ts`: incremental graph merge and edge/suggestion updates
- `graph-validation.ts`: normalization and validation of relation extraction results
- `google-drive/`: Google OAuth, Drive client, and Drive storage adapter

Route handlers should call these modules instead of duplicating logic. UI components should depend on types and API responses, not filesystem or Drive internals.

Storage model:

```text
papers/      original PDFs
summaries/   canonical per-paper summary JSON files
cache/       graph.json graph memory and render snapshot
```

`graph.json` intentionally keeps summary snapshots for fast graph loading and
candidate selection, but `summaries/{paperId}.summary.json` is the durable
per-paper record.
