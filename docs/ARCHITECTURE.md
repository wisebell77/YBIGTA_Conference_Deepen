# Architecture

## System Flow

```text
browser
-> Next.js route handlers
-> storage adapter
-> PDF extraction
-> LLM metadata extraction
-> candidate selection
-> LLM relation extraction
-> graph validation
-> incremental merge
-> storage adapter write
-> React Flow UI
```

## Upload Pipeline

The upload pipeline is implemented in:

```text
src/lib/analyze.ts
```

Main function:

```ts
analyzeUploadedPaper({
  projectId,
  pdfBuffer,
  originalFilename
})
```

Pipeline:

```text
1. Save PDF through storage adapter.
2. Extract raw text from PDF.
3. Extract paper metadata and summary.
4. Read or create graph.
5. Select candidate papers from existing graph nodes.
6. Ask LLM for relations between new paper and candidates.
7. Hydrate relation output into PaperEdge and EdgeSuggestion records.
8. Merge into graph without overwriting existing graph data.
9. Persist graph.
```

## Module Responsibilities

### `src/lib/types.ts`

Defines the shared domain model:

- `GraphData`
- `PaperNode`
- `PaperEdge`
- `EdgeSuggestion`
- `AnalysisSettings`
- `StorageAdapter`
- relation enums
- relation labels
- edge style constants
- `createEmptyGraph`

### `src/lib/storage.ts`

Owns storage selection and local storage behavior.

Responsibilities:

- choose `local` or `google_drive` based on `STORAGE_BACKEND`
- read/write `graph.json`
- save PDFs
- read PDFs
- create backups before graph writes
- hydrate old graph data with missing defaults

### `src/lib/google-drive/*`

Owns Google OAuth and Google Drive storage behavior.

Important point: the rest of the app should not call Drive APIs directly. It should use `StorageAdapter`.

### `src/lib/pdf.ts`

Extracts text from uploaded PDF buffers.

### `src/lib/llm.ts`

Calls the LLM for:

- paper metadata and summary
- paper-to-paper relation extraction

Also contains fallback behavior for local development when no API key is present.

### `src/lib/candidates.ts`

Selects top-k existing papers to compare with the new paper.

Current MVP scoring uses lexical overlap between:

- title
- keywords
- summary

This module is the right place to add embeddings later.

### `src/lib/graph-validation.ts`

Normalizes and validates LLM relation output before merge.

Key purpose: prevent LLM output from introducing invalid relation types or references to nonexistent paper ids.

### `src/lib/merge.ts`

Implements the incremental graph merge policy.

Critical rules:

- preserve old nodes
- preserve old edges
- never overwrite user-edited edges
- detect duplicate edges
- turn conflicts into suggestions
- apply confidence thresholds
- update `updatedAt`

### `src/components/GraphWorkspace.tsx`

Main client UI.

Responsibilities:

- fetch graph
- upload PDF
- filter papers and relations
- render React Flow graph
- render custom edge labels/arrows
- show hover explanations
- edit edges
- create custom edges
- accept/reject suggestions
- resize side panels
- toggle node shape mode

### `src/components/PaperNode.tsx`

Custom React Flow paper node.

Important: it must keep source and target handles. Without handles, React Flow cannot attach custom edges correctly.

## Storage Boundary

Use this interface:

```ts
interface StorageAdapter {
  readGraph(projectId: string): Promise<GraphData | null>;
  writeGraph(projectId: string, graph: GraphData): Promise<void>;
  savePdf(projectId: string, file: Buffer, filename: string): Promise<StoredFile>;
  readPdf(projectId: string, fileId: string): Promise<Buffer>;
}
```

Any future storage provider should implement this interface.

## UI Boundary

The UI consumes `GraphData` and converts it to React Flow nodes and edges in `GraphWorkspace.tsx`.

Do not store React Flow-specific data in `graph.json`. `graph.json` should remain a domain data file.
