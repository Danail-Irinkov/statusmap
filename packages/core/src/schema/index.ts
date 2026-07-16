// Schema v1 — the five typed control-plane contracts (the Phase-S foundation).
//
// The single overloaded ledger object is split into five purpose-typed contracts, with an authored↔derived
// split that BANS authored proof fields (the structural anti-false-green guarantee, PRD §13 / G1):
//   - ledger-v1   — the AUTHORED map (identity / lifecycle / bindings / ext only; proof fields banned)
//   - signal-v1   — one PROVENANCE-preserving observation (producer / reason / confidence / evidence)
//   - derived-v1  — computed RUNTIME truth (health / proof / red-attribution; the honesty rules live here)
//   - work-v1     — a control-plane ENVELOPE (state + attempts + approval + externalRunRef; NOT an engine)
//   - snapshot-v1 — the composite L0 renders and L2/L3 read (ledger + signals + derived + workItems)
//
// Additive: this sits alongside the existing `Ledger`/`Coverage` model + the frozen render DSL. Nothing
// here is wired into the renderer yet.

export * from './ledger-v1'
export * from './signal-v1'
export * from './derived-v1'
export * from './work-v1'
export * from './snapshot-v1'
