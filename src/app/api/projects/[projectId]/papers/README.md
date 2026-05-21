# papers

Paper PDF routes for one project.

- `upload/`: accepts a new PDF, analyzes it, merges graph changes, and persists the updated graph.
- `[fileId]/`: streams a stored PDF back to the browser.

PDF files are storage-backed. They may live in local `data/` or in the connected user's Google Drive depending on `STORAGE_BACKEND`.

After upload, the analysis pipeline also writes one per-paper summary file:

```text
summaries/{paperId}.summary.json
```

This keeps future graph updates from re-reading old original PDFs.
