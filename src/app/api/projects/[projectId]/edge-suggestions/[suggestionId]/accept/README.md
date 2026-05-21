# accept

Route: `POST /api/projects/:projectId/edge-suggestions/:suggestionId/accept`

Accepts a pending edge suggestion. If the suggestion targets an existing edge, it updates that edge and marks it as user-edited. If not, it creates a user-created edge.

Implementation lives in `src/lib/merge.ts` via `acceptSuggestion`.

