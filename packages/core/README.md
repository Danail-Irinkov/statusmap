# @statusmap/core

Honest, test-aware project status maps — the framework-agnostic core. **Zero runtime dependencies.**

Describe your app as a tree of **areas → features → user intents → workflows** in plain YAML, and this turns
it into a validated ledger you can render. The opinionated, honest defaults are the point: only shipped +
proven work counts as fully "up", and deferred / planned / not-built work counts as **down** — so the
headline % tells the truth.

```bash
npm install @statusmap/core
```

## Quick start — YAML in, a bundle out

```ts
import { createStatusMap } from '@statusmap/core'
import { load } from 'js-yaml'

const files = import.meta.glob('./status/**/*.yaml', { query: '?raw', import: 'default', eager: true })
const { ledger } = createStatusMap(files, load)
```

`createStatusMap` takes a `{ path → raw YAML }` map (exactly what Vite's `import.meta.glob` returns, or build
one from a Node `fs` walk), splits the `areas.yaml` doc from the per-feature files, parses + validates, and
returns a `StatusMapBundle`. The YAML parser is injected so core stays dependency-free.

**To render it, use [`@statusmap/vue`](https://www.npmjs.com/package/@statusmap/vue)'s `<StatusMap :files="files" />`** — it bundles the YAML
parsing + the whole renderer (the 4 views, drill-down, and the review filter). This core package is the data
layer + headless use.

## The YAML

```
status/
  areas.yaml                      # the areas: [{ id, label, order?, summary? }]
  features/<area>/<id>.yaml       # one file per feature
```

Each feature: `id` / `label` / `areaId` / `lifecycle` (+ optional `summary`, `intents` → `workflows`,
`coverage`, `gaps`). Copy the
[`features/_template.yaml`](https://github.com/Danail-Irinkov/statusmap/blob/main/packages/core/examples/ledger/features/_template.yaml)
file to start; a worked synthetic example app lives in the
[`examples/ledger` directory](https://github.com/Danail-Irinkov/statusmap/tree/main/packages/core/examples/ledger).

## The honest rules (`DEFAULT_STATUS_RULES`)

Every opinionated rule lives in **one read-only object** — read it to understand exactly what the library
decides (it is reference + docs, not a configuration surface):

- **Health math** — `live` = up (100%); `built` / `beta` / `partial` = 50%; `deferred` / `planned` /
  `not_built` / `unknown` = **down** (0%).
- **Beta-test ready** — use lifecycle `beta` only when a limited real path is reachable, its limits are
  visible, targeted tests pass, and rendered UI proof exists. Mock-only work stays `planned`.
- **The proof-level ladder** — `none → heuristic → unit → owning_e2e → destination`. A machine signal can
  raise an intent's proof at most to `owning_e2e`; it never fabricates the human "I looked at it" level, and
  a real failure forces the status red.

## Status from real test artifacts

Feed it your CI output and each intent gets a navigable, failing-first proof tree:

```ts
import { buildTestResults, applyCoverageTests } from '@statusmap/core'

const results = buildTestResults({ vitestJson, playwrightJson }) // standard reporter JSON
const proven = applyCoverageTests(ledger, results)               // overlays a testTree onto matching intents
```

## API

- **Entry** — `createStatusMap(files, parse)` → `StatusMapBundle`.
- **The rules** — `DEFAULT_STATUS_RULES` (read-only reference).
- **Advanced / lower-level** — the ledger model + `validateLedger` / `assembleLedger`; the view generators
  (`ledgerToOverview` / `ledgerToArea` / `ledgerToFeatureDetail` / `ledgerToFlat`); the review filter
  (`filterLedger`); the coverage overlay (`applyCoverage`) + the vitest/playwright ingestion; `statusTone`.
  Most consumers never touch these — `@statusmap/vue`'s `<StatusMap>` calls them for you.

## License

MIT.
