// Schema v1 — the Derived runtime-state contract (`statusmap.derived.v1`).
//
// This is RUNTIME TRUTH: the computed health / proof / red-attribution per node, produced by folding the
// authored ledger with the signals (see `applySignals`). The authored ledger is the *intended* map; this
// is *what is actually working right now*. The honesty rules live HERE — this is the only place a node may
// be reported green, and only when a resolving evidence ref says so.
//
// Reuses `Health`/`ProofLevel`/`Lifecycle` (ledger/types.ts), `NodeId`/`StatusMapLedgerV1` (ledger-v1.ts),
// `SignalId`/`StatusMapSignalV1` (signal-v1.ts), `WorkItemId` (work-v1.ts).

import type { Health, Lifecycle, ProofLevel } from '../ledger/types'
import type { NodeId, RepoId, StatusMapLedgerV1 } from './ledger-v1'
import type { SignalId, StatusMapSignalV1 } from './signal-v1'
import type { WorkItemId } from './work-v1'

// The computed state of one node. `computedHealth` reuses the existing health vocab (up/partial/down) plus
// `unknown` for "no live evidence either way". `proof.passing` is tri-state: true (proven pass), false
// (proven fail), or null (no live signal — the authored snapshot stands, never asserted green).
export type NodeRuntimeStateV1 = {
	nodeId: NodeId

	computedLifecycle: Lifecycle
	computedHealth: Health | 'unknown'

	proof: {
		level: ProofLevel
		passing: boolean | null //   null = no resolving signal; never reported as green
		sourceSignalId?: SignalId
		evidenceRef?: string //      no evidenceRef ⇒ no green (G1)
		lastObservedAt?: string
		testTreeRef?: string
	}

	// EVERY active signal id on the node — losing signals are kept for audit / regression / L3 reproduction.
	activeSignalIds: SignalId[]

	// Present iff the node is red, and then fully attributed (G2: signalId + producer + reason + evidence).
	red?: {
		signalId: SignalId
		producerId: string
		reason: string
		evidenceRef: string
		confidence?: number
	}

	openWorkItemId?: WorkItemId
}

export type StatusMapDerivedStateV1 = {
	schemaVersion: 'statusmap.derived.v1'
	repoId: RepoId
	sourceLedgerRevision: string //  the ledgerRevision this state was derived from (the handshake)
	generatedAt: string
	policyVersion: string //         which honesty-policy version produced this fold
	nodes: Record<NodeId, NodeRuntimeStateV1>
}

// ─────────────────────────────────────────────────────────────────────────────────
// HONESTY RULES — the load-bearing invariants this fold MUST enforce (PRD §13, G1/G2; the a-thread
// consult's "Hard honesty rules"). These are the whole point of the authored↔derived split:
//
//   1. The authored ledger CANNOT contain proof, passing, health, tests, matrix, or testTree — those
//      fields do not exist on LedgerNodeV1, so an L1 worker structurally cannot hand-write green.
//   2. Non-heuristic proof requires a resolving `evidenceRef`. No evidenceRef ⇒ no green.
//   3. A machine signal's proof caps at `owning_e2e` UNLESS producer.type === 'judge' AND
//      evidence.kind === 'destination-proof' (only a judged destination reaches the top rung).
//   4. Any `fail` signal forces computedHealth to `down` (or `partial` by policy) — built-but-broken
//      reads red, never green.
//   5. Green requires a `pass` signal at the required proof level.
//   6. No `signalId` ⇒ no `red` (every red is attributed + cited — no anonymous reds).
// ─────────────────────────────────────────────────────────────────────────────────

// Fold the authored ledger with the observed signals into runtime truth. Enforces the honesty rules above:
// a node is green ONLY with a resolving pass signal + evidenceRef at the required proof level; a fail forces
// it down; a machine signal cannot reach `destination` unless it is a judge destination-proof.
//
// TODO(phase-S/S3): implement the fold. The TYPE contract + the honesty-rule comment block are the
// deliverable for this slice; the body is wired in S3 (`applySignals()` + `snapshot()`). Until then this is
// a typed stub that returns an empty derived state for the ledger's revision.
export function applySignals(
	ledger: StatusMapLedgerV1,
	signals: StatusMapSignalV1[],
): StatusMapDerivedStateV1 {
	// TODO: attribute each signal to its node, apply precedence, and compute health/proof/red under the
	// honesty rules. `signals` is intentionally unused in this stub.
	void signals
	return {
		schemaVersion: 'statusmap.derived.v1',
		repoId: ledger.repo.id,
		sourceLedgerRevision: ledger.ledgerRevision,
		generatedAt: new Date().toISOString(),
		policyVersion: 'statusmap.policy.v1',
		nodes: {},
	}
}
