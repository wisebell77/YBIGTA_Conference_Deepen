# `src/lib/google-drive` Module Notes

> **이 폴더는 무엇인가요?**
> Google OAuth 인증, Drive 클라이언트, Drive 기반 저장소 어댑터를 담당합니다. `STORAGE_BACKEND=google_drive`일 때 PDF와 `graph.json`이 사용자의 Google Drive에 저장되도록 합니다.
>
> **다른 폴더와의 관계**
> - 상위 [`src/lib`](../README.md)가 정의한 `StorageAdapter` 계약을 Drive용으로 구현합니다. 그래서 로컬 모드와 Drive 모드를 바꿔도 분석/UI 코드는 그대로입니다.
> - [`src/app/api/auth/google/*`](../../app/api/README.md) 라우트가 이 폴더의 `auth.ts` / `auth-store.ts`를 사용해 OAuth 흐름을 처리합니다.
> - 다른 모듈은 Google API를 직접 호출하지 않고 반드시 이 폴더를 거칩니다. OAuth 토큰은 절대 클라이언트로 노출되지 않습니다.

This folder owns Google OAuth, Drive clients, and Drive-backed storage. Other modules should not call Google APIs directly.

## Files

- `constants.ts`
  - Shared Drive folder names and OAuth/session constants.
- `auth.ts`
  - Builds OAuth clients and Google authorization URLs.
  - Exchanges callback codes for credentials.
- `auth-store.ts`
  - Stores OAuth credentials.
  - Uses Postgres when `DATABASE_URL` is configured.
  - Uses `GOOGLE_AUTH_FILE` for local development when Postgres is not configured.
- `drive-client.ts`
  - Creates authenticated Drive clients.
  - Resolves project folders and file operations.
- `storage-adapter.ts`
  - Implements the shared `StorageAdapter` contract for Google Drive.
  - Stores PDFs and `graph.json` in Drive.

## Intended Drive Layout

```text
Deepen/
  projects/
    demo-project/
      papers/
      cache/
        graph.json
```

The app code should treat this as equivalent to local storage. Switching `STORAGE_BACKEND` should not require UI or analysis changes.

## Rules

- Never expose OAuth tokens to client components.
- Keep Drive-specific file IDs behind the storage adapter where possible.
- Preserve `graph.json` semantics exactly the same as local mode.
- If Drive upload routing changes, keep the chunked path for large PDFs so deployment body limits are not exceeded.
