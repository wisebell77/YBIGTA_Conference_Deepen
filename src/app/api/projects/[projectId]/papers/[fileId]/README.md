# [fileId]

Route: `GET /api/projects/:projectId/papers/:fileId`

Streams a stored PDF for viewing in the browser. The `fileId` is either a local file id or a Google Drive file id, depending on the active storage backend.

With Google Drive storage, the adapter checks that the PDF belongs to this project's `papers` folder before reading it.

