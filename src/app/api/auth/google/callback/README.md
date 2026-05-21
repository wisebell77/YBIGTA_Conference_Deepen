# callback

Route: `GET /api/auth/google/callback`

Google redirects here after the user approves or denies Drive access. The handler exchanges the one-time OAuth `code`, reads the Google profile, stores/updates refresh tokens, creates a session cookie, and redirects back to the app.

Important: OAuth `code` values are single-use. Refreshing a failed callback URL can produce `invalid_grant`; restart from `/api/auth/google/start` instead.

