# graph

Route: `GET /api/projects/:projectId/graph`

Loads the project's graph memory. If no graph exists, the storage layer returns an empty graph shape so the UI can render a blank workspace.

With Google Drive storage, this route reads:

```text
/Deepen/projects/{projectId}/cache/graph.json
```

`graph.json` contains graph structure and lightweight paper node snapshots. The
canonical per-paper summary files live in:

```text
/Deepen/projects/{projectId}/summaries/{paperId}.summary.json
```

With local storage, it reads:

```text
data/projects/{projectId}/cache/graph.json
```
