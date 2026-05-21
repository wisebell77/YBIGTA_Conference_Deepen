# logout

Route: `POST /api/auth/google/logout`

Deletes the local app session cookie and removes the session record from the auth store. This does not revoke Google permissions or delete Drive files.

Use this when adding account switching UI.

