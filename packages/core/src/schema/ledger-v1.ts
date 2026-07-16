// Schema v1 — the authored Ledger contract (`statusmap.ledger.v1`).
//
// This is the AUTHORED map: durable intent + binding metadata a worker (or a human) hand-writes. It is the
// *intended* map of a repo, NOT runtime truth — computed health/proof/red live in the derived state
// (derived-v1.ts), never here. The authored↔derived split is the structural anti-false-green guarantee
// (PRD G1): an L1 worker may author the map, but CANNOT author green, because the fields that would let
// them (health/passing/proofLevel/tests/…) are absent from `LedgerNodeV1` by construction.
//
// Reuses the existing vocab — `Lifecycle` (the build axis) and `ProofLevel` (the proof ladder) — from
// ledger/types.ts. Additive: the existing `Ledger`/`Coverage`/render-DSL model is untouched.

import type { Lifecycle, ProofLevel } from '../ledger/types'

// ── Identity ─────────────────────────────────────────────────────────────────

// A repo identifier, e.g. 'app-web' | 'app-admin'. The first path segment of every NodeId.
export type RepoId = string

// The repo a ledger describes: the id plus which adapter shape its bindings target. `adapter` names the
// repo-specific producer/runner family (e.g. 'quasar-vite') so a validator can reject a binding
// selector the adapter does not support; it is NOT a plugin loader.
export type RepoRef = {
	id: RepoId
	adapter?: string
}

// The four node kinds — the authored hierarchy: area → feature → intent → workflow. (Distinct from the
// frozen 8-kind RENDER DSL section union in types.ts; this is the ledger hierarchy, that is the drawing.)
export type NodeKind = 'area' | 'feature' | 'intent' | 'workflow'

// The canonical global join key — ONE id used everywhere (no global joins on local intentId, no lane
// joins, no first-match-wins). A template-literal path that encodes the full lineage, so two features can
// share a local intent name yet have distinct NodeIds. The depth is the kind:
//   repo:<id>/area:<a>
//   repo:<id>/area:<a>/feature:<f>
//   repo:<id>/area:<a>/feature:<f>/intent:<i>
//   repo:<id>/area:<a>/feature:<f>/intent:<i>/workflow:<w>
export type NodeId =
	| `repo:${RepoId}/area:${string}`
	| `repo:${RepoId}/area:${string}/feature:${string}`
	| `repo:${RepoId}/area:${string}/feature:${string}/intent:${string}`
	| `repo:${RepoId}/area:${string}/feature:${string}/intent:${string}/workflow:${string}`

// ── Bindings — how a node binds to the signals that prove/break it ─────────────
//
// Portable replacement for domain-specific routing lanes: core gets a typed `bindings[]`; repo-specific
// routing language lives under a `domain` binding selector and/or `ext`. L2 uses these to attach
// a signal to exactly one node; the selector is the producer-neutral query.
export type NodeBindingV1 =
	| {
			type: 'test'
			runner: 'playwright' | 'cypress' | 'vitest' | 'jest' | 'node' | 'manual'
			selector: {
				fileGlob?: string
				testId?: string
				titleContains?: string
				titleRegex?: string
				artifactName?: string
				suite?: string
			}
	  }
	| {
			type: 'runtime'
			producer: string
			selector: {
				route?: string
				capabilityId?: string
				eventName?: string
				surface?: string
			}
	  }
	| {
			type: 'feature-health'
			producer: string
			selector: {
				featureHealthId: string
			}
	  }
	| {
			type: 'domain'
			producer: string
			selector: Record<string, string>
	  }

// ── Typed extension namespace ──────────────────────────────────────────────────
//
// `ext` is a typed-adapter namespace, NOT a plugin framework: per-repo durable metadata that core does not
// interpret. Repos declare typed shapes in their own adapters; the index signature keeps core repo-neutral:
// no source-app data lives in core, only the namespace slot.
export type DomainStatusMapExtV1 = Record<string, unknown>
export type NodeExtV1 = {
	domain?: DomainStatusMapExtV1
	[repoOrDomain: string]: unknown
}

// ── The authored node ───────────────────────────────────────────────────────────
//
// CRITICAL — the authored shape carries identity / intent / bindings / extension ONLY. The proof-bearing
// fields are BANNED here (see `BannedAuthoredField` below): an authored ledger structurally cannot assert
// health, passing, a proof level, tests, a test tree, an evidence ref, a computed value, or an open work
// item. `desiredProofLevel` IS allowed — it is a TARGET to reach, not evidence that it was reached.
export type LedgerNodeV1 = {
	nodeId: NodeId
	kind: NodeKind
	localId: string //          the last path segment (e.g. 'open-drawer'); unique under its parent
	parentNodeId?: NodeId //    absent on an area (the root kind)

	label: string
	summary?: string //         the "what it does" line — also seeds L3's derived reproduction
	lifecycle: Lifecycle //     the build axis (reused vocab); health/proof are NOT authored

	bindings?: NodeBindingV1[]
	owner?: string
	prdRefs?: string[] //       provenance: spec/PRD docs the node was mined from
	tags?: string[]

	desiredProofLevel?: ProofLevel // a TARGET (allowed); evidence of reaching it lives in derived state
	ext?: NodeExtV1
}

// The fields BANNED from an authored ledger node — listed as a type for the validator + as documentation of
// the whole point of the authored↔derived split. The `LedgerNodeV1` shape above already omits them; this
// names them so the `statusmap-validate` CLI can reject any authored YAML that smuggles one back in
// (`computed*` matches computedHealth / computedProof / computedLifecycle / …).
export type BannedAuthoredField =
	| 'health'
	| 'passing'
	| 'proofLevel'
	| 'owningE2e'
	| 'matrix'
	| 'tests'
	| 'testTree'
	| 'lastRun'
	| 'evidenceRef'
	| 'computedHealth'
	| 'computedProof'
	| 'computedLifecycle'
	| 'openWorkItemId'

// The list value backing `BannedAuthoredField`, for a runtime validator to iterate. Kept in sync with the
// type above. (`computed*` is enforced as a prefix check by the validator, beyond these exact keys.)
export const BANNED_AUTHORED_FIELDS: readonly BannedAuthoredField[] = [
	'health',
	'passing',
	'proofLevel',
	'owningE2e',
	'matrix',
	'tests',
	'testTree',
	'lastRun',
	'evidenceRef',
	'computedHealth',
	'computedProof',
	'computedLifecycle',
	'openWorkItemId',
] as const

// ── The authored ledger document ─────────────────────────────────────────────────
export type StatusMapLedgerV1 = {
	schemaVersion: 'statusmap.ledger.v1'
	repo: RepoRef
	namespace: string //        a stable namespace for the ledger (usually the repo id)
	ledgerRevision: string //   a monotonically-advancing revision token (e.g. an ISO stamp) — the handshake
	nodes: LedgerNodeV1[]
}
