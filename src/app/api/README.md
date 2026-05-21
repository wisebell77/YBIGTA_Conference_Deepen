# api

Server route handlers for the app. These routes are the boundary between browser UI and server-side capabilities such as PDF parsing, Google OAuth, Google Drive storage, and graph persistence.

Route handlers should:

- validate request inputs
- call `src/lib` modules for business logic
- return JSON or file responses
- avoid storing state in module globals

Important children:

- `auth/`: Google OAuth connection and session state
- `projects/`: project graph, paper upload/read, edge edits, and suggestion actions

