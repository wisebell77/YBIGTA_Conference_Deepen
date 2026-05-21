# [edgeId]

Route: `PATCH /api/projects/:projectId/edges/:edgeId`

Updates an existing graph edge. Only these fields should be accepted from the client:

- `relationType`
- `label`
- `shortDescription`
- `longDescription`

The merge layer marks edited edges as `userEdited=true` and `relationSource="user_edited"` so future LLM output does not overwrite them.

