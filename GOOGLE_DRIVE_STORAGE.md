# Google Drive storage

Local storage remains the default. To use Google Drive as the storage backend:

```env
STORAGE_BACKEND=google_drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_AUTH_FILE=./data/tokens/google-auth.json
```

Start OAuth at:

```text
/api/auth/google/start?projectId=demo-project
```

The app also exposes:

```text
GET /api/auth/google/status
POST /api/auth/google/logout
```

Drive storage creates and uses this app-owned structure:

```text
/Deepen/projects/{projectId}/papers
/Deepen/projects/{projectId}/cache/graph.json
```

Normal upload flow should analyze only the newly uploaded paper and compare it
against existing paper summaries in `graph.json`. Listing PDFs from Drive is
intended for first import, manual sync, or recovery when `graph.json` is missing.

## Multi-user token storage

For local development, OAuth users, refresh tokens, and sessions are stored in:

```text
./data/tokens/google-auth.json
```

For shared deployments, set `DATABASE_URL` to a Postgres database. The app will
create these tables automatically:

```text
deepen_users
deepen_google_tokens
deepen_sessions
```

Each browser session is tied to its own Google account, so different teammates
can connect different Drives and see their own `/Deepen/projects/{projectId}`
graph data.
