# Contributing

Thanks for considering a contribution to statusmap.

## Project shape

This repo currently has two package-local npm projects:

- `packages/core` for the framework-agnostic ledger model, rollups, validation, and test artifact ingestion.
- `packages/vue` for the Vue 3 renderer and source-shipped component API.

There is no root workspace manifest yet. Run installs and checks inside each package.

## Local checks

Before opening a pull request, run the relevant package checks.

```bash
cd packages/core
npm ci
npm run build
npm test
npm run typecheck
npm run lint:pkg
npm run pack:dry

cd ../vue
npm ci
npm test
npm run typecheck
npm run build:bundle
```

For docs-only changes, at minimum inspect the changed Markdown and run any package
checks affected by examples or API snippets you changed.

## Pull requests

- Keep changes scoped to one purpose.
- Add or update tests for behavior changes.
- Update package READMEs or the root README when public APIs, install steps, or release steps change.
- Do not include consumer-private ledgers, screenshots, local paths, credentials, or generated archives in public changes.
