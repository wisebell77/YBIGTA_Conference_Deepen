# app

Next.js App Router entrypoint. Files in this folder define pages, layouts, global CSS, and server route handlers.

- `page.tsx` renders the main graph workspace for the current project.
- `layout.tsx` defines the root HTML shell.
- `globals.css` contains global styling and third-party CSS imports.
- `api/` contains server-only route handlers.

Do not put graph algorithms or Google Drive API logic directly in page components. UI should call API routes, and API routes should call `src/lib`.

