// @statusmap/core — public API.
//
// The render contract (a serializable StatusMapDefinition), the tone resolver, the ledger model + the
// status policy (health math, lifecycle/tone vocab, the proof-level ladder), the generators that project a
// ledger into definitions, runtime validation, the coverage-signal overlay, and vitest/playwright
// test-artifact ingestion. Framework-agnostic; render a definition with @statusmap/vue or your own renderer.

export * from './types'
export * from './runner'
export * from './status-rules'
export * from './tone'

export * from './ledger/types'
export * from './ledger/rollup'
export * from './ledger/progress'
export * from './ledger/generators'
export * from './ledger/schema'
export * from './ledger/coverage-signal'
export * from './ledger/coverage-tests-ingest'

// The unified, framework-neutral filter (PRD §6.6 / D-006): one state shape + one predicate + a pure store +
// a URL codec, owned by core so every renderer shares one implementation.
export * from './ledger/filter'
export * from './ledger/filter-store'
// Back-compat shim — re-exports `filterLedger`/verdict vocab under their original names PLUS the deprecated
// `ReviewFilter` alias + the `isReviewFilterActive`/`reviewFilterSummary` aliases. Selective to avoid a
// duplicate-export collision with `./ledger/filter` (which owns the canonical names).
export { type ReviewFilter, isReviewFilterActive, reviewFilterSummary } from './ledger/review-filter'

export * from './ledger/loaders'
export * from './create'
