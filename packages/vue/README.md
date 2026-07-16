# @statusmap/vue

**Drop in YAML, get a rendered, filterable status map.** The everyday API is one component.

![Statusmap overview showing mixed product health across areas and features](https://raw.githubusercontent.com/Danail-Irinkov/statusmap/main/docs/images/statusmap-overview.png)

```bash
npm install @statusmap/vue @statusmap/core vue
```

Start with the copy-ready
[`starter-ledger`](https://github.com/Danail-Irinkov/statusmap/tree/main/packages/core/examples/starter-ledger).
It begins as `planned` with `proofLevel: none`, so the map cannot look green before the work is real.

```vue
<script setup lang="ts">
import { StatusMap } from '@statusmap/vue'
import '@statusmap/vue/styles.css'

const files = import.meta.glob('./status/**/*.yaml', { query: '?raw', import: 'default', eager: true })
</script>

<template>
  <StatusMap :files="files" brand="Acme" />
</template>
```

Both imports resolve via the package `exports`: `@statusmap/vue` → `src/index.ts`, and
`@statusmap/vue/styles.css` → `src/styles/statusmap.css`. `@statusmap/core` is a peer dependency
because the renderer shares its public types and ledger helpers with the consuming app.

That's it. `<StatusMap>` parses the YAML (it bundles js-yaml), builds the ledger, and renders **everything**:
the overview / area / feature / "all on one page" views, the click-through drill-down, and the **review
filter** (status × verdict) — with **no router wiring** (it manages its own drill state internally).

![Statusmap feature detail showing a failing proof tree](https://raw.githubusercontent.com/Danail-Irinkov/statusmap/main/docs/images/statusmap-feature-proof.png)

The YAML structure is `areas.yaml` + `features/<area>/<id>.yaml`; see the `@statusmap/core`
README for the shape and a synthetic example app.

The renderer is responsive and includes dark-mode tokens:

![Statusmap mobile overview in dark mode](https://raw.githubusercontent.com/Danail-Irinkov/statusmap/main/docs/images/statusmap-mobile-dark.png)

### Props

| Prop | What |
|---|---|
| `files` | the `{ path → raw YAML }` map from `import.meta.glob` |
| `ledger` | a pre-built `Ledger` (alternative to `files`) |
| `brand` | optional product name shown in titles |
| `parse` | a custom YAML parser (defaults to js-yaml's `load`) |
| `playwrightJson` / `vitestJson` | parsed test reports to overlay onto matching `coverage.owningE2e` / `coverage.matrix` nodes |
| `runner` | optional `StatusMapRunnerOptions`; when `enabled`, existing runnable nodes show token-styled Run buttons and live results re-overlay in place |

## Live Runner

`runner` is progressive enhancement. With no runner, the map renders as a read-only status map. With an
enabled runner, Run buttons appear only on existing nodes that have `coverage.owningE2e` / `coverage.matrix`
targets. The library owns the UI, running state, result overlay, and watched-run player window; the consumer
only supplies the environment-specific execution handler.

```ts
import type { StatusMapRunnerOptions } from '@statusmap/vue'

const runner: StatusMapRunnerOptions = {
  enabled: import.meta.env.DEV,
  async *run(target) {
    // Spawn tests in your app/dev server and yield typed RunEvent objects.
    yield { type: 'result', exitCode: 0, report: await fetchReport(target.specs) }
  },
  async listTests({ featureId, specs }) {
    return [{ file: specs[0], tests: [{ title: featureId, line: 1 }] }]
  },
}
```

Treat every runner target as untrusted input: resolve specs against an allowlisted test root, pass them as
process arguments without shell interpolation, and reject paths outside that root. If a consumer exposes a
runner over HTTP, keep it authenticated and development-only. Test reports and screencast frames can contain
sensitive project data; do not publish or retain them unintentionally.

Watched runs (`target.watch`) open a detached, resizable `statusmap-run` window with the screencast feed,
selected tracks, and bottom transport controls. Fresh Playwright JSON from a `result` event uses the same
matching path as the static `playwrightJson` overlay.

## Theming

Override any `--statusmap-*` custom property on an ancestor (the full set — layout/type tokens + the five
tone families `done` / `attention` / `problem` / `neutral` / `active`, each `-fg` / `-bg` / `-border` /
`-dot` — is in `src/styles/statusmap.css`, which also ships a `prefers-color-scheme: dark` block).

## Advanced

Most apps only need `<StatusMap>`. For router-integrated or lower-level use the package also exports:
`StatusMapExplorer` (controlled, props-driven over a `Ledger`, route state passed in), `StatusMapPage`
(render a single `StatusMapDefinition`), the section components, and the `useStatusMapLink` /
`useStatusMapFilter` composables.

## Consumption

The v0.1 runtime entry intentionally ships as Vue/TypeScript source; generated declarations ship under
`dist/`. A fresh stock Vue 3 + Vite application using `@vitejs/plugin-vue` is installed and built from the
actual package tarballs by `scripts/verify-packed-consumer.mjs`, with no `optimizeDeps` or transpilation
exceptions. Use `"moduleResolution": "Bundler"` in TypeScript projects so package exports resolve normally.

Install `@statusmap/core@^0.1.0` beside this package; it is a peer because the renderer and consumer share
its public types and ledger helpers. Publish core first so the peer resolves for new installs.

Plain `require()` / Node CommonJS and non-Vite bundlers are not supported v0.1 contracts. A toolchain that
explicitly excludes package source from its Vue transform may need its own allowlist; that configuration is
toolchain-specific and is not required by the proven Vite path.

The package type audit therefore ignores ATTW's Node-internal-resolution rule for `.vue` declarations while
still requiring clean publint and ATTW bundler results. The packed Vite consumer is the release acceptance gate.

## License

MIT.
