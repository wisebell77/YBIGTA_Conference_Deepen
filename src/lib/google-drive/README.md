# google-drive

Google OAuth and Google Drive storage integration.

This folder owns:

- OAuth URL generation and callback session creation
- per-user token/session storage
- Google Drive client creation
- Drive folder/file helpers
- `GoogleDriveStorageAdapter`, which implements the app's `StorageAdapter`

Storage layout in the connected user's Drive:

```text
/Deepen/projects/{projectId}/papers
/Deepen/projects/{projectId}/summaries
/Deepen/projects/{projectId}/cache/graph.json
```

`papers/` stores original PDFs. `summaries/` stores one canonical summary JSON
per paper. `cache/graph.json` stores graph structure and lightweight node
snapshots for rendering and candidate selection.

Important files:

- `constants.ts`: OAuth scopes, cookie name, Drive folder names
- `auth.ts`: OAuth client helpers, session lookup, auth status
- `auth-store.ts`: file/Postgres token and session persistence
- `drive-client.ts`: low-level Drive API helpers
- `storage-adapter.ts`: graph/PDF storage adapter used by `src/lib/storage.ts`

Never return access tokens or refresh tokens to the browser. Browser UI should only use `/api/auth/google/status`, `/api/auth/google/start`, and project APIs.
