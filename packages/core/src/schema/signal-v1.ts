// Schema v1 — the Signal contract (`statusmap.signal.v1`).
//
// A signal is one observation about a node from one producer at one moment: a CI test result, a runtime
// error, a judge verdict, a human review. PROVENANCE-PRESERVING by design — it carries the producer, the
// reason, the confidence, and an evidence ref, and it is NEVER flattened to a bare passing/proofLevel pair.
// Every red the system shows must name the signal that caused it (PRD G2: no anonymous reds), which is only
// possible because the signal keeps its identity + citation. Losing signals still matter — they feed audit,
// regression analysis, and L3 reproduction — so the derived state keeps ALL active signal ids per node.
//
// Reuses `ProofLevel` from ledger/types.ts and `NodeId` from ledger-v1.ts. Additive: it does NOT replace
// the existing `CoverageSignal` overlay (coverage-signal.ts) — that stays for legacy map consumers.

import type { ProofLevel } from '../ledger/types'
import type { NodeBindingV1, NodeId, RepoId } from './ledger-v1'

export type SignalId = string

// Where a signal points: the canonical node, plus (optionally) the binding it matched through, so a human
// can audit WHY this signal was attributed to this node.
export type SignalTargetV1 = {
	nodeId: NodeId
	matchedByBinding?: NodeBindingV1
}

// Who produced the signal. `type` distinguishes a deterministic test runner from an AI judge — the
// honesty rules cap a machine signal at owning_e2e UNLESS it is a judge asserting destination proof.
export type SignalProducerV1 = {
	id: string //               the producer id, e.g. 'feature-health' | 'playwright'
	type: 'test-runner' | 'runtime-watcher' | 'judge' | 'adapter' | 'manual-review'
	version?: string
	runId?: string
}

// The citation: a resolvable pointer to the artifact that backs the signal. `kind: 'destination-proof'` is
// the only evidence that (with a judge producer) unlocks the top of the proof ladder. Without an
// `evidenceRef` there is no green (PRD G1).
export type EvidenceRefV1 = {
	evidenceRef: string //      a stable id/handle for the evidence
	kind:
		| 'test-artifact'
		| 'runtime-log'
		| 'screenshot'
		| 'trace'
		| 'judge-report'
		| 'destination-proof'
		| 'manual-note'
	uri?: string
	path?: string
	sha256?: string
	observedAt: string //       ISO; when the evidence was observed
	citation?: string //        a human-readable one-line citation
}

// One observation about a node.
//
// Required always: schemaVersion, signalId, repoId, target.nodeId, verdict, proofLevel, producer(.id/.type),
// evidence(.evidenceRef/.observedAt). Required for a `fail`/`blocked` verdict: `reason` (no anonymous red).
// Required for a judge-produced destination proof: `confidence`.
export type StatusMapSignalV1 = {
	schemaVersion: 'statusmap.signal.v1'
	signalId: SignalId
	repoId: RepoId
	target: SignalTargetV1
	verdict: 'pass' | 'fail' | 'blocked' | 'unknown'
	proofLevel: ProofLevel
	producer: SignalProducerV1
	evidence: EvidenceRefV1
	reason?: string //          required when verdict is 'fail' | 'blocked' (validator-enforced)
	confidence?: number //      0..1; required for a judge destination proof (validator-enforced)
	rawRef?: string //          optional pointer to the raw producer payload
}
