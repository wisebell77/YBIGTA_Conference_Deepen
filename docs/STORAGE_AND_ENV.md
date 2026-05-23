# Storage And Environment

## Which Env File Matters

Use `.env` for actual local execution.

Use `.env.example` as a template only.

Never commit real secrets.

## Local Mode

Recommended while Google Drive access is unstable:

```env
STORAGE_BACKEND=local
LOCAL_STORAGE_ROOT=./local_data
GOOGLE_AUTH_FILE=./local_data/tokens/google-auth.json
```

Local mode stores project data under:

```text
local_data/projects/:projectId
```

For the default demo:

```text
local_data/
  projects/
    demo-project/
      papers/
      cache/
        graph.json
        graph.json.bak
```

## Google Drive Mode

Google Drive mode is selected with:

```env
STORAGE_BACKEND=google_drive
```

Required OAuth fields:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

The Google Drive adapter should keep the same project layout concept:

```text
/Deepen/
  /projects/
    /project_id/
      /papers/
      /cache/
        graph.json
```

## LLM Settings

Default deployment target is Upstage:

```env
LLM_PROVIDER=upstage
UPSTAGE_API_KEY=...
UPSTAGE_BASE_URL=https://api.upstage.ai/v1
LLM_MODEL=solar-pro3
LLM_RESPONSE_FORMAT_JSON=true
```

For OpenAI comparison, use:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4.1-mini
```

If the selected provider key is missing, local fallback behavior allows development of the upload/merge/UI flow without paid LLM calls.

## PDF Text Extraction

Local mode uses `pdf-parse`. To use Upstage Document Parse before Solar analysis:

```env
PDF_TEXT_PROVIDER=upstage
PDF_TEXT_FALLBACK_TO_LOCAL=true
UPSTAGE_DOCUMENT_PARSE_URL=https://api.upstage.ai/v1/document-digitization
UPSTAGE_DOCUMENT_PARSE_MODEL=document-parse
UPSTAGE_DOCUMENT_PARSE_OCR=auto
UPSTAGE_DOCUMENT_PARSE_OUTPUT_FORMAT=markdown
```

`PDF_TEXT_FALLBACK_TO_LOCAL=true` keeps uploads usable if Document Parse fails or a document contains content that is better handled by the existing local parser. Use `UPSTAGE_DOCUMENT_PARSE_OCR=force` for scanned PDFs.

## Upload Limit

```env
MAX_UPLOAD_MB=20
```

The upload route should reject non-PDF uploads and files above this size.

In Google Drive mode, the browser asks the server for a Drive resumable upload URL and then sends the PDF to the server in small chunks. Each chunk stays below Vercel's request body limit, and the server forwards the chunk to Google Drive. After Drive returns a `driveFileId`, the analysis route downloads the Drive file as a stream for Upstage Document Parse and falls back to the existing Buffer-based path if stream upload is not accepted.

Large PDFs can take longer than one minute because analysis includes Drive download, Document Parse, Solar metadata extraction, and Solar relation extraction. The upload analysis routes set `maxDuration = 300`; keep Vercel Fluid Compute enabled or set the project Function Max Duration high enough for deployment tests.

## StorageAdapter

All storage backends must implement:

```ts
interface StorageAdapter {
  readGraph(projectId: string): Promise<GraphData | null>;
  writeGraph(projectId: string, graph: GraphData): Promise<void>;
  savePdf(projectId: string, file: Buffer, filename: string): Promise<StoredFile>;
  readPdf(projectId: string, fileId: string): Promise<Buffer>;
}
```

Do not couple API routes or UI components directly to local filesystem or Google Drive APIs.

## Backup Behavior

`LocalStorageAdapter.writeGraph` writes a backup before replacing `graph.json`:

```text
graph.json.bak
```

If a future write path is changed, keep this safety behavior or replace it with an equivalent backup strategy.

## Git Rules

Do not commit:

- `.env`
- `local_data/`
- `data/`
- `.next/`
- `node_modules/`

Commit:

- source code
- scripts
- docs
- `.env.example`
- `package-lock.json`
