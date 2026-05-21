# start

Route: `GET /api/auth/google/start`

Starts Google OAuth by redirecting the browser to Google's consent screen. The optional `projectId` query parameter is passed through OAuth `state` so the callback can return the user to the same project context.

This route does not create folders or touch Drive files. It only begins the permission flow.

