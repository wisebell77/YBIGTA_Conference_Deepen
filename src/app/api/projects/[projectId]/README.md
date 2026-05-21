# [projectId]

Dynamic project API scope. Every route below this folder operates on one project graph and should use the `projectId` route parameter when reading or writing storage.

Current child resources:

- `graph/`: read graph memory
- `papers/`: upload/read paper PDFs
- `edges/`: edit existing graph edges
- `edge-suggestions/`: accept or reject suggested edge changes

Do not hardcode `demo-project` inside these route handlers; only the current UI page hardcodes that default.

