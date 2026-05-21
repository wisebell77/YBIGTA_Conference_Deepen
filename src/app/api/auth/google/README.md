# google

Google OAuth route group. These routes let a browser session connect to one Google account and use that account's Drive as storage.

Flow:

```text
GET /api/auth/google/start
  -> redirects to Google OAuth
GET /api/auth/google/callback
  -> exchanges the one-time OAuth code
  -> stores user tokens
  -> creates session cookie
GET /api/auth/google/status
  -> reports whether the current browser session is connected
POST /api/auth/google/logout
  -> deletes only the local app session
```

Refresh tokens are stored by `src/lib/google-drive/auth-store.ts`. Do not expose tokens to the browser.

