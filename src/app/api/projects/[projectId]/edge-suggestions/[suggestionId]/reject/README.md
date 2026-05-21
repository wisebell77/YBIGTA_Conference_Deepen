# reject

Route: `POST /api/projects/:projectId/edge-suggestions/:suggestionId/reject`

Rejects a pending edge suggestion by changing its status to `rejected`. It does not delete the suggestion, preserving graph history for later inspection.

Implementation lives in `src/lib/merge.ts` via `rejectSuggestion`.

