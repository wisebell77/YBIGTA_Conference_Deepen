# src

Application source code lives here. This project uses the Next.js App Router, so `app/` defines routes and pages, `components/` contains client UI, and `lib/` contains server/shared business logic.

Keep framework entrypoints thin. Route handlers and pages should call into `lib/` instead of reimplementing PDF parsing, graph merging, storage, or OAuth logic inline.

Main flow:

```text
UI upload -> API route -> lib/analyze -> storage adapter -> graph merge -> UI reload
```

