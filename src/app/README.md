# `src/app` Module Notes

> **이 폴더는 무엇인가요?**
> Next.js App Router의 진입점입니다. 사용자가 처음 보는 페이지(`page.tsx`)와 전체 레이아웃(`layout.tsx`), 그리고 모든 서버 API 라우트(`api/`)가 여기 모입니다.
>
> **다른 폴더와의 관계**
> - 화면 UI는 직접 그리지 않고 [`src/components`](../components/README.md)의 `GraphWorkspace`를 불러와 띄웁니다.
> - 도메인 로직(그래프 병합, PDF 추출, LLM 호출 등)은 직접 구현하지 않고 [`src/lib`](../lib/README.md)를 호출합니다.
> - `api/` 라우트는 브라우저와 `src/lib` 사이의 얇은 경계 역할만 합니다. 자세한 내용은 [`api/README.md`](./api/README.md) 참고.

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
  - Route handlers for graph data, PDF upload/analysis, edge editing/refresh, summary translation, the graph chatbot, and Google OAuth.

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
