# projects

Project-scoped API routes. A project represents one graph memory namespace, currently hardcoded in the UI as `demo-project`.

All child routes include a dynamic `[projectId]` segment. Storage adapters map this id to either:

- local files under `data/projects/{projectId}`
- Google Drive files under `/Deepen/projects/{projectId}`

Future project creation/selection UI should keep using this route group instead of creating separate global graph endpoints.

