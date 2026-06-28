# `scripts` Module Notes

> **이 폴더는 무엇인가요?**
> 로컬 개발용 유지보수 스크립트 모음입니다. 런타임 API의 일부가 아니라, `npm run` 명령으로 직접 실행하는 보조 도구입니다.
>
> **다른 폴더와의 관계**
> - `clean-next.mjs`는 `package.json`의 `dev` / `build` 스크립트가 빌드 전에 자동으로 실행합니다.
> - `seed-local-data.mjs`는 저장소 바깥의 `../data_papers/` PDF를 복사해 `local_data/`에 데모 그래프를 만듭니다. 이는 [`src/lib/storage.ts`](../src/lib/README.md)의 로컬 저장소 구조와 같은 모양을 따릅니다.

This folder contains local maintenance scripts. They are not part of the runtime API.

## `clean-next.mjs`

Removes stale `.next` output before `dev` and `build`.

Why it exists:

- Next.js incremental output can occasionally leave stale generated chunks.
- Cleaning before server start avoids errors such as `Cannot find module './611.js'`.

## `seed-local-data.mjs`

Creates or refreshes the local demo project.

Responsibilities:

- Copies demo PDFs from `../data_papers` into `local_data/projects/demo-project/papers`.
- Generates a demo `graph.json`.
- Seeds paper nodes, relation edges, UI settings, and default analysis settings.

Use:

```bash
npm run seed:local
```

Do not run this against production storage. It is intentionally local/demo oriented.
