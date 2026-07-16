// Schema v1 — the Snapshot contract (`statusmap.snapshot.v1`).
//
// The composite the L0 renderer draws and the L2/L3 automation reads: the authored ledger + the observed
// signals + the derived runtime state + the open work items, bundled at one moment. The AUTHORED ledger is
// the intended map; the DERIVED state is runtime truth — a renderer paints from `derived`, citing
// `signals`, and surfaces `workItems` as the coordination layer. This sits UNDER the frozen 8-kind render
// DSL (types.ts), not in place of it: a projector turns a snapshot into a StatusMapDefinition.
//
// Reuses every v1 contract. Additive — does not touch the existing `Ledger` model or the render DSL.

import type { StatusMapLedgerV1 } from './ledger-v1'
import type { StatusMapSignalV1 } from './signal-v1'
import type { StatusMapDerivedStateV1 } from './derived-v1'
import type { StatusMapWorkItemV1 } from './work-v1'

export type StatusMapSnapshotV1 = {
	schemaVersion: 'statusmap.snapshot.v1'
	ledger: StatusMapLedgerV1
	signals: StatusMapSignalV1[]
	derived: StatusMapDerivedStateV1
	workItems: StatusMapWorkItemV1[]
}

// Bundle the four parts into the renderable/readable snapshot. `derived` is expected to be the output of
// `applySignals(ledger, signals)` (see derived-v1.ts) — the honesty rules are enforced THERE, during the
// fold; this composer only assembles. Keeping `applySignals` as the single fold means a snapshot can never
// disagree with the derived state's honesty math.
//
// TODO(phase-S/S3): no extra logic is expected beyond assembly + a schemaVersion stamp; the honesty work
// lives in `applySignals`. The signature + this doc comment are the deliverable for this slice.
export function snapshot(
	ledger: StatusMapLedgerV1,
	signals: StatusMapSignalV1[],
	derived: StatusMapDerivedStateV1,
	workItems: StatusMapWorkItemV1[],
): StatusMapSnapshotV1 {
	return {
		schemaVersion: 'statusmap.snapshot.v1',
		ledger,
		signals,
		derived,
		workItems,
	}
}
