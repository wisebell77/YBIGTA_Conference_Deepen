# `scripts` Module Notes

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
