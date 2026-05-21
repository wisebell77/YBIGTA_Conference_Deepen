# auth

Authentication and external account connection routes. Currently this folder only contains Google OAuth for connecting a user's Google Drive.

This is not a full app account system yet. It creates a server-side session cookie tied to the Google account that completed OAuth, then Drive requests use that session to read the correct refresh token.

Google-specific routes live in `google/`.

