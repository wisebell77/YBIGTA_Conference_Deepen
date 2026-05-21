# status

Route: `GET /api/auth/google/status`

Returns whether the current browser session is connected to a Google Drive account.

The UI uses this route to decide whether to show `Connect Google Drive` or the connected account email. This route must never return access tokens or refresh tokens.

