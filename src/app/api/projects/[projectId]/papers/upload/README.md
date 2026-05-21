# upload

Route: `POST /api/projects/:projectId/papers/upload`

Accepts `multipart/form-data` with a `file` field containing a PDF. The route validates the file and delegates the full analysis pipeline to `src/lib/analyze.ts`.

Pipeline:

```text
save PDF -> extract text -> summarize metadata -> save paper summary
-> load graph -> select candidates -> extract relations -> merge graph -> persist graph
```

Keep this route thin. Changes to graph generation should usually happen in `src/lib/analyze.ts`, `src/lib/candidates.ts`, `src/lib/llm.ts`, or `src/lib/merge.ts`.
