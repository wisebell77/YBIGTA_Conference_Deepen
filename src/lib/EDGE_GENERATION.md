# Edge Generation Logic

This app creates automatic paper relationships when a new PDF is uploaded. Users can also manually refresh existing generated edges from the current settings. Saving settings alone does not rewrite existing nodes, edges, or suggestions.

## Pipeline

1. Store the uploaded PDF through the configured storage backend.
   - `STORAGE_BACKEND=local` writes under `local_data/projects/...`.
   - `STORAGE_BACKEND=google_drive` writes through the Google Drive adapter.
2. Extract text from the PDF.
   - `PDF_TEXT_PROVIDER=local` uses `pdf-parse`.
   - `PDF_TEXT_PROVIDER=upstage` uses Upstage Document Parse, with optional local fallback.
3. Ask the configured LLM to extract paper metadata, summary, keywords, and searchable text.
4. Select candidate existing papers from the current `graph.json`.
5. Ask the LLM to compare the new paper with candidate paper summaries and return relationship JSON.
6. Validate the LLM response.
7. Merge valid results into `graph.json` as edges or suggestions.


## Manual Refresh Existing Graph

The UI can call:

```http
POST /api/projects/:projectId/edges/refresh
```

This endpoint uses `refreshGeneratedEdges` in `refresh-edges.ts`.

Refresh behavior:

- preserve user-created and user-edited edges;
- remove generated edges from the current graph;
- clear old suggestions;
- replay papers in `createdAt` order;
- select candidates from papers already replayed;
- call the configured LLM only for selected candidate pairs;
- merge results through the same validation and merge rules used by upload analysis.

Because refresh can trigger multiple LLM calls, the UI exposes it as an explicit button rather than running it automatically whenever settings change.

## Candidate Selection

Candidate papers are selected in `candidates.ts`.

Each existing paper receives a lexical similarity score:

```text
score =
  titleWeight * titleOverlap +
  keywordWeight * keywordOverlap +
  summaryWeight * summaryOverlap
```

The score is normalized by the total configured weight. Tokenization uses Unicode
letters and numbers, so Korean and English titles/summaries are both supported.

The following settings control candidate selection:

- `candidateLimitPerNewPaper`: maximum candidate papers sent to the LLM.
- `candidateTitleWeight`: title overlap weight.
- `candidateKeywordWeight`: keyword overlap weight.
- `candidateSummaryWeight`: summary overlap weight.
- `candidateMinScore`: minimum score when zero-score fallback is disabled.
- `includeZeroScoreCandidates`: when true, still sends recent papers if lexical overlap is zero.

## LLM Relation Policy

The LLM prompt is defined in `llm.ts`.

The model is asked to:

- create edges only between papers;
- connect only the new paper to candidate papers;
- avoid overwriting existing edges;
- use directed edges when knowledge flow is meaningful;
- use undirected edges when direction is ambiguous;
- store conflicts or weak-but-interesting relations as suggestions;
- return Korean labels/descriptions while keeping enum values in English.

Allowed relation types:

- `extends`
- `prerequisite`
- `supports`
- `contradicts`
- `applies`
- `uses_method`
- `compares_with`
- `conceptually_related`
- `background`
- `unknown`

The `customEdgePrompt` setting is appended to the base prompt as a project-specific
policy. Use it for local preferences such as stricter evidence requirements or
preferred relation types.

## Validation And Merge

`graph-validation.ts` rejects invalid LLM output:

- unknown paper IDs;
- self-edges;
- edges that do not touch the new paper;
- unsupported relation types;
- evidence attached to unknown papers.

`merge.ts` decides whether a valid relation becomes an edge or suggestion:

- `confidence >= minConfidenceForAutoEdge`: auto edge.
- `confidence >= minConfidenceForSuggestion`: suggestion.
- duplicate edge: ignored.
- same paper pair with a different relation: suggestion.
- user-edited edge conflict: existing edge is preserved and the LLM result becomes a suggestion.

## Configuration

Settings live inside each project's `graph.json` under `analysisSettings`.
Because `graph.json` is written through the active storage adapter, the settings
persist in either local storage or Google Drive depending on `STORAGE_BACKEND`.

Users can edit the same settings in the app:

```text
left sidebar -> Settings -> Edge generation details -> more / Refresh Edges
```

This is intentionally JSON-backed rather than YAML-backed so the app can store
graph data and project-specific analysis policy atomically in one file. If a
separate YAML config is added later, it should hydrate into the same
`AnalysisSettings` shape before upload analysis runs.
