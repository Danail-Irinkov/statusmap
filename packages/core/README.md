# @statusmap/core

Honest, test-aware project status maps — the framework-agnostic core. **Zero runtime dependencies.**

Describe your app as a tree of **areas → features → user intents → workflows** in plain YAML, and this turns
it into a validated ledger you can render. The opinionated, honest defaults are the point: only shipped +
proven work counts as fully "up", and deferred / planned / not-built work counts as **down** — so the
headline % tells the truth.

![Statusmap overview showing mixed product health across areas and features](https://raw.githubusercontent.com/Danail-Irinkov/statusmap/main/docs/images/statusmap-overview.png)

```bash
npm install @statusmap/core
```

## Start with honest YAML

```yaml
# status/areas.yaml
- id: product
  label: Your product
  summary: 'Replace this with the part of your product this area owns.'
```

```yaml
# status/features/product/your-feature.yaml
id: your-feature
label: Your feature
areaId: product
lifecycle: planned
summary: 'Replace this with the user-visible outcome.'

intents:
  - id: primary-outcome
    label: Complete the main user outcome
    lifecycle: planned
    coverage:
      proofLevel: none
    workflows:
      - id: first-step
        label: Replace with the first real step
        lifecycle: planned

gaps:
  - 'What must be true before this can move from planned to beta?'
```

This begins at 0% on purpose: the feature is planned and has no proof. Copy the
[`starter-ledger`](https://github.com/Danail-Irinkov/statusmap/tree/main/packages/core/examples/starter-ledger)
or inspect the richer fictional
[`Acme Notes ledger`](https://github.com/Danail-Irinkov/statusmap/tree/main/packages/core/examples/ledger).

## YAML in, a bundle out

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
`coverage`, `gaps`). The detailed
[`features/_template.yaml`](https://github.com/Danail-Irinkov/statusmap/blob/main/packages/core/examples/ledger/features/_template.yaml)
documents the full authoring surface.

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

![Statusmap feature detail showing a failing proof tree](https://raw.githubusercontent.com/Danail-Irinkov/statusmap/main/docs/images/statusmap-feature-proof.png)

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
