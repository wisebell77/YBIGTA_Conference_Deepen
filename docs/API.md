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

### Update graph settings

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
  },
  "analysisSettings": {
    "candidateLimitPerNewPaper": 8,
    "candidateTitleWeight": 0.2,
    "candidateKeywordWeight": 0.5,
    "candidateSummaryWeight": 0.3,
    "candidateMinScore": 0,
    "includeZeroScoreCandidates": true,
    "minConfidenceForAutoEdge": 0.68,
    "minConfidenceForSuggestion": 0.45,
    "customEdgePrompt": ""
  }
}
```

Behavior:

- validates relation color values as hex colors
- validates edge line styles as `solid`, `dashed`, or `dotted`
- validates node shape, booleans, and finite node coordinates
- validates analysis weights, thresholds, candidate limits, and prompt text
- stores UI settings in `graph.json`
- stores edge generation settings in `graph.json`
- returns the updated graph

Analysis settings are read automatically when a new paper is analyzed. Updating them does
not rewrite existing graph data by itself. To apply the current settings to existing
papers, the UI must explicitly call the generated-edge refresh endpoint.

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

### Google Drive chunked upload

Production uploads use a chunked Google Drive path when the user is connected:

```http
POST /api/projects/:projectId/papers/drive-upload-session
Content-Type: application/json
```

Request:

```json
{
  "filename": "paper.pdf",
  "size": 123456,
  "mimeType": "application/pdf"
}
```

The response contains a Google Drive resumable `uploadUrl`. The browser splits the PDF into small chunks and sends each chunk to:

```http
POST /api/projects/:projectId/papers/drive-upload-chunk
Content-Type: application/octet-stream
```

Required headers:

```text
X-Drive-Upload-Url: Google Drive resumable upload URL
X-Upload-Start: zero-based byte start
X-Upload-End: inclusive byte end
X-Upload-Total: full PDF byte size
X-Upload-Content-Type: application/pdf
```

Each request stays below Vercel's Function body limit, and the server forwards the chunk to Google Drive. This avoids browser CORS issues on Drive resumable upload URLs while still supporting PDFs larger than Vercel's single-request upload limit.

After Drive returns the uploaded file id:

```http
POST /api/projects/:projectId/papers/analyze-drive-file
Content-Type: application/json
```

Request:

```json
{
  "driveFileId": "google-drive-file-id"
}
```

The server verifies that the file belongs to the current project folder, streams it to Upstage Document Parse first, falls back to the existing Buffer path if streaming fails, and then runs the normal metadata, summary, relation extraction, and graph merge pipeline.

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

### Translate paper summary to Korean

```http
POST /api/projects/:projectId/papers/:fileId/translate-summary
```

Behavior:

- finds the paper node by id
- if `summaryKo` and `shortSummaryKo` already exist, returns them without calling the LLM
- otherwise calls the LLM to translate `summary` / `shortSummary` into Korean
- stores `summaryKo`, `shortSummaryKo`, and `translationUpdatedAt` in `graph.json`
- returns the updated paper and graph

```json
{
  "success": true,
  "paper": {},
  "graph": {}
}
```

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

### Refresh generated edges

```http
POST /api/projects/:projectId/edges/refresh
```

Behavior:

- reads the current graph and `analysisSettings`
- preserves user-controlled edges (`userEdited=true`, `user_created`, or `user_edited`)
- removes generated edges and clears previous suggestions before recomputing
- replays existing papers in `createdAt` order and compares each paper only with previously processed candidates
- calls the configured LLM for selected candidate pairs, so this endpoint can incur provider cost
- writes the refreshed graph
- returns updated graph data and refresh stats

Response:

```json
{
  "success": true,
  "graph": {},
  "stats": {
    "paperCount": 10,
    "preservedUserEdges": 2,
    "removedGeneratedEdges": 12,
    "generatedEdges": 9,
    "pendingSuggestions": 3
  }
}
```

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

## Chat

### Graph chatbot

```http
POST /api/projects/:projectId/chat
Content-Type: application/json
```

Body:

```json
{
  "messages": [
    { "role": "user", "content": "이 그래프에서 RAG와 가장 관련 깊은 논문은?" }
  ]
}
```

Behavior:

- requires a non-empty `messages` array whose last entry has `role: "user"` (otherwise `400 USER_MESSAGE_REQUIRED`)
- reads the current graph and builds a read-only chat context
- calls the LLM and returns a Korean answer plus optional proposed edge actions
- never mutates `graph.json`; proposed actions are applied only after the user approves them through the normal edge routes

Response:

```json
{
  "success": true,
  "answer": "한국어 답변",
  "proposedActions": [
    {
      "id": "chat_action_xxx",
      "type": "create_edge",
      "reason": "한국어 근거",
      "input": {
        "source": "paper_a",
        "target": "paper_b",
        "directed": true,
        "relationType": "custom",
        "label": "관계 라벨",
        "shortDescription": "짧은 설명",
        "longDescription": "자세한 설명"
      }
    }
  ]
}
```
