# `src/app` Module Notes

This folder contains the Next.js App Router entry points.

## Files

- `layout.tsx`
  - Root HTML shell and metadata.
  - Keep global providers here only if they need to wrap the entire app.
- `page.tsx`
  - Main project page.
  - Currently mounts `GraphWorkspace` for the default project.
- `globals.css`
  - Global Tailwind layers and app-wide base styling.
- `api/`
  - Route handlers for graph data, PDF upload/analysis, edge editing/refresh, and Google OAuth.

## Boundaries

- UI state belongs in `src/components`.
- Domain rules belong in `src/lib`.
- Route handlers should stay thin: parse/validate request data, call `src/lib`, return JSON or file responses.
- Do not read provider secrets in client components. Environment variables with API keys must only be used from server code.

## Current Page Flow

```text
page.tsx
-> GraphWorkspace
-> /api/projects/demo-project/graph
-> route handlers
-> storage adapter
```

If multi-project routing is added later, keep the same API shape and pass the selected `projectId` into `GraphWorkspace`.
