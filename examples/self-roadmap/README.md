# Self-roadmap — the framework mapping itself

The **AI Code-Maintenance Framework**'s own development roadmap + progress ledger, authored in the statusmap
ledger format and rendered by the statusmap library — an optional dog-food demo of itself.

## Demo doctrine (read before editing)

This is the intentionally honest dog-food view, not a curated showcase. The point of statusmap is that it
*refuses to lie about itself*, so this route must hold to that even when it costs a prettier screenshot:

- **Proof fields are artifact-backed.** Every non-`none` proof level resolves to a real artifact — a vitest
  run (`./artifacts/core-vitest.json`), an `npm pack`, or this page's own reproducible render. Never flip a
  node green without one; that is the framework's one invariant.
- **The most-built layer earns the full ladder.** L0 (the library itself) is real, so it honestly exercises
  the whole proof ladder — `none → heuristic → unit → owning_e2e → destination` — plus a real failing node.
- **Planned automation stays planned.** L1–L4 remain `planned`/down until the control-plane loop earns proof.
  A mostly-down map is not a liability here — it is the proof that the library won't green unbuilt work.
- **No faked failures.** The one failing node is a real, clearly-labeled, **non-gating** known-failure
  artifact (a TDD test for the unbuilt Cypress adapter) — never a fake break to light up the "Failing" chip.
- **The synthetic ledger is the public front door.** It gives new consumers a neutral first run; this
  self-roadmap remains available for maintainers and proof inspection.

## Run the demo
From `statusmap/packages/vue`:

    node node_modules/vite/bin/vite.js --config demo/vite.config.mjs demo

then open **http://localhost:4317/** for the synthetic "Acme Notes" consumer example. The self-roadmap starts
at **http://localhost:4317/?demo=self** in the **QA-scan "What works now"** view. From there:

- **Explore map** → `?demo=self&view=explore` — the drill-down explorer (area → feature → intents + proof trees).
- **All on one page** → `?demo=self&view=flat` — every feature expanded (a docs/export view).

## The real artifacts it ingests
`./artifacts/` holds the test JSON the library turns into the failing-first proof trees you see:

- `core-vitest.json` — a **real, green** `@statusmap/core` run (ground truth). Regenerate with
  `./artifacts/_regen.mjs` (see its header). Intents join to it by `coverage.owningE2e` / `matrix`.
- `known-failing.cypress-adapter.json` — a **clearly-labeled, non-gating** known-failure fixture (a TDD
  result for an unbuilt capability). It is NOT part of `npm test`; it exists only to demonstrate the
  renderer's failing-first behavior honestly. Bound to the `planned` `cypress-adapter` intent.
- `planning-provenance.md` — a local note that caps historical framework-planning nodes at `heuristic`;
  the original private planning artifacts are not required by this OSS repo.
- `package-proof.json` — the latest tarball-only install, dual ESM/CommonJS core-runtime, stock Vue/Vite
  consumer-build, payload/leak-scan, and production-audit result.
- `render-proof.json` — the latest compact accessibility, console, overflow, theme, viewport, and
  interaction result for the public demo and self-roadmap routes.

## Screenshot proof (this is what makes a render-node `destination`)
From the repo root (Playwright), with the demo running:

    node examples/self-roadmap/shot.mjs        # → shots/self-roadmap-qa-*.png

A `destination`-level proof claim means exactly this reproducible render route displayed correctly — not "a
screenshot exists" and not "a unit test passed".

## Honesty validator
`node examples/self-roadmap/validate.mjs` (run from `statusmap/`) fails if any node claims a non-`none`/
non-`heuristic` proof without a resolving, non-ignored artifact, if proof is hand-authored inline instead of
ingested, or if a failing node is not backed by a labeled known-failure artifact. This makes the same proof
available in a clean clone. Run it after editing the ledger.

## Keep it current
Edit the YAML in `features/<area>/<id>.yaml`; as each phase lands, flip its `lifecycle` and add a real
`coverage.evidenceRef` — the rollup updates itself. (That is **L1 — a worker maintaining the map — done by
hand until L1 is built.**) The OSS demo's source of truth is this self-contained ledger plus the artifacts
under `examples/self-roadmap/artifacts/`.
