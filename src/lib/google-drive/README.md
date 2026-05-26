# `src/lib/google-drive` Module Notes

This folder owns Google OAuth, Drive clients, and Drive-backed storage. Other modules should not call Google APIs directly.

## Files

- `constants.ts`
  - Shared Drive folder names and OAuth/session constants.
- `auth.ts`
  - Builds OAuth clients and Google authorization URLs.
  - Exchanges callback codes for credentials.
- `auth-store.ts`
  - Stores OAuth credentials.
  - Uses Postgres when `DATABASE_URL` is configured.
  - Uses `GOOGLE_AUTH_FILE` for local development when Postgres is not configured.
- `drive-client.ts`
  - Creates authenticated Drive clients.
  - Resolves project folders and file operations.
- `storage-adapter.ts`
  - Implements the shared `StorageAdapter` contract for Google Drive.
  - Stores PDFs and `graph.json` in Drive.

## Intended Drive Layout

```text
Deepen/
  projects/
    demo-project/
      papers/
      cache/
        graph.json
```

The app code should treat this as equivalent to local storage. Switching `STORAGE_BACKEND` should not require UI or analysis changes.

## Rules

- Never expose OAuth tokens to client components.
- Keep Drive-specific file IDs behind the storage adapter where possible.
- Preserve `graph.json` semantics exactly the same as local mode.
- If Drive upload routing changes, keep the chunked path for large PDFs so deployment body limits are not exceeded.
