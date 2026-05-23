# API Reference

Default local project id:

```text
demo-project
```

## Graph

### Read graph

```http
GET /api/projects/:projectId/graph
```

Response:

```json
{
  "success": true,
  "graph": {}
}
```

Used by:

- initial UI load
- reload button
- post-write refresh flows

If Google Drive mode is enabled but the browser has not connected a Drive
account yet, this route returns an empty graph shape instead of a server error.

### Update graph UI settings

```http
PATCH /api/projects/:projectId/graph
Content-Type: application/json
```

Body:

```json
{
  "uiSettings": {
    "edgeColors": {
      "extends": "#111827",
      "custom": "#312e81"
    },
    "edgeLineStyles": {
      "extends": "solid",
      "background": "dashed",
      "unknown": "dotted"
    },
    "nodeShapeMode": "circle",
    "showEdgeLabels": false,
    "freeMoveMode": true,
    "nodePositions": {
      "paper_001": { "x": 120, "y": 240 }
    }
  }
}
```

Behavior:

- validates relation color values as hex colors
- validates edge line styles as `solid`, `dashed`, or `dotted`
- validates node shape, booleans, and finite node coordinates
- stores UI settings in `graph.json`
- returns the updated graph

## Papers

### Upload and analyze PDF

```http
POST /api/projects/:projectId/papers/upload
Content-Type: multipart/form-data
```

Form field:

```text
file: PDF
```

Pipeline:

```text
save PDF
-> extract PDF text
-> LLM metadata/summary
-> read existing graph
-> select candidate papers
-> LLM relation extraction
-> graph validation
-> incremental merge
-> write graph
```

Response:

```json
{
  "success": true,
  "paperId": "paper_xxx",
  "graph": {}
}
```

### Read PDF

```http
GET /api/projects/:projectId/papers/:fileId
```

Returns:

```text
application/pdf
```

In local mode, `fileId` is `PaperNode.localFileId`.

In Google Drive mode, it maps to the Drive file id through the storage adapter.

### Delete paper node

```http
DELETE /api/projects/:projectId/papers/:paperId
```

Behavior:

- removes the paper node from `graph.json`
- removes connected edges
- removes suggestions that reference that paper
- removes saved node position
- does not delete the original PDF file from local storage or Google Drive

## Edges

### Create user edge

```http
POST /api/projects/:projectId/edges
Content-Type: application/json
```

Body:

```json
{
  "source": "paper_a",
  "target": "paper_b",
  "directed": true,
  "relationType": "custom",
  "label": "Custom relation",
  "shortDescription": "Short explanation",
  "longDescription": "Long explanation"
}
```

Behavior:

- validates source and target paper ids
- rejects self edges
- creates a permanent edge
- sets `relationSource=user_created`
- sets `userEdited=true`
- sets `llmGenerated=false`
- writes graph
- returns updated graph

### Update edge

```http
PATCH /api/projects/:projectId/edges/:edgeId
Content-Type: application/json
```

Body:

```json
{
  "relationType": "contradicts",
  "label": "Contradicts",
  "shortDescription": "Short edited description",
  "longDescription": "Long edited description"
}
```

Editable fields:

- `relationType`
- `label`
- `shortDescription`
- `longDescription`

Immutable fields:

- `id`
- `source`
- `target`
- `createdAt`

Behavior:

- sets `userEdited=true`
- sets `relationSource=user_edited`
- updates `updatedAt`
- writes graph
- returns updated edge and graph

### Delete edge

```http
DELETE /api/projects/:projectId/edges/:edgeId
```

Behavior:

- removes the edge from `graph.json`
- removes suggestions targeting that edge
- writes graph
- does not modify source paper nodes or PDFs

## Edge Suggestions

### Accept suggestion

```http
POST /api/projects/:projectId/edge-suggestions/:suggestionId/accept
```

Behavior:

- if `targetEdgeId` exists, applies the accepted suggestion to that edge only through explicit user approval
- otherwise creates a new edge from the suggestion
- marks suggestion as accepted
- writes graph

### Reject suggestion

```http
POST /api/projects/:projectId/edge-suggestions/:suggestionId/reject
```

Behavior:

- marks suggestion as rejected
- writes graph

## Google OAuth

### Start OAuth

```http
GET /api/auth/google/start?projectId=demo-project
```

Redirects to Google OAuth.

### OAuth callback

```http
GET /api/auth/google/callback
```

Stores returned credentials through the auth store.

### Status

```http
GET /api/auth/google/status
```

Returns whether Google Drive is connected.

### Logout

```http
POST /api/auth/google/logout
```

Clears stored auth credentials.
