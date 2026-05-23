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

```env
OPENAI_API_KEY=
LLM_MODEL=gpt-4.1-mini
```

If `OPENAI_API_KEY` is missing, local fallback behavior allows development of the upload/merge/UI flow without paid LLM calls.

## Upload Limit

```env
MAX_UPLOAD_MB=20
```

The upload route should reject non-PDF uploads and files above this size.

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
