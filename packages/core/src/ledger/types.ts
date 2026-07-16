// The ledger — the single source of truth for a whole-app status tree. Deferred + not-built work is
// INCLUDED and counts as down, so the rollup tells the true completeness of the product, not a vanity %.
//
// Shape: areas (L1) → features (L2) → user intents → workflows (the drill-deep view). Generators project
// this into StatusMapDefinitions; nothing here renders directly.

// Health is the truth axis the rollup math uses: up=100%, partial=50%, down=0%.
export type Health = 'up' | 'partial' | 'down'

// Lifecycle is the build axis (why something is up/down). Deferred/planned/not_built resolve to `down`.
export type Lifecycle =
	| 'live' //       shipped + working in production
	| 'built' //      implemented + working (maybe not production-verified)
	| 'beta' //       beta-test ready: limited real path with proof, not live-ready
	| 'partial' //    some intents work, others don't
	| 'deferred' //   intentionally parked
	| 'planned' //    designed (spec/PRD) but not built
	| 'not_built' //  no implementation yet
	| 'unknown' //    GAP: needs confirmation (treated as down until confirmed)

// How well an intent/workflow is PROVEN by the test suite — the "intent test coverage" the map surfaces.
// A ladder from weakest to strongest: a heuristic guess < a unit test < the owning end-to-end test < a
// human who looked at the destination state. Machine signals cap at `owning_e2e` (see coverage-signal.ts).
export type ProofLevel = 'destination' | 'owning_e2e' | 'unit' | 'heuristic' | 'none'

// One concrete test case that exercises an intent/workflow, with its last-known result. Should be a REAL
// case (the actual `it()` / `test()` name + a real run result, or ingested from a test artifact) — not
// hand-invented. The deep view lists these failing-first under the intent.
export type CoverageTest = {
	name: string //      the real test-case title (the `it()` / `test()` name)
	file?: string //     the owning spec/test file
	passing: boolean //  last known result; false = currently failing
	skipped?: boolean // the test exists but did not run (skip/xfail) — ranked between fail and pass
}
// A node in the test-ledger tree: a suite / describe-stage / test / e2e step. The explorer drills
// file → describe-stages → test → (e2e) step — the "last mile". Leaves carry their own result; suites roll
// up. `counts` tallies descendant LEAVES (drives the group badge + the fold-passers split).
export type TestStatus = 'passed' | 'failed' | 'skipped'
export type TestNode = {
	name: string //         describe / test / step title
	status: TestStatus //   leaf = own result; suite = rolled up (fail if any leaf fails)
	counts: { passed: number; failed: number; skipped: number } // descendant-leaf tallies
	file?: string //        owning spec file (set on the file-level node)
	line?: number //        source line for a runnable test node when the artifact provides it
	children?: TestNode[] // suites/steps; absent on a leaf
}
export type Coverage = {
	owningE2e?: string //   the e2e spec that owns this intent
	matrix?: string //      the harness/QA matrix that covers it
	proofLevel?: ProofLevel
	lastRun?: string //     ISO or human date of the last green run
	passing?: boolean //    last known result
	evidenceRef?: string // doc/artifact pointer (a results.json row, a test-state doc, etc.)
	tests?: CoverageTest[] // hand-authored flat cases (fallback when no run tree is ingested)
	testTree?: TestNode[] // the ingested test-ledger tree (suite → stage → test → step), run-verified
}

export type ScopeProgressStage =
	| 'planned' //         known idea, no PRD/spec yet
	| 'prd_ready' //       PRD/spec exists and describes the intended work
	| 'foundation' //      primitives/foundation are in place
	| 'building' //        current planned scope is actively being built
	| 'tested' //          implementation exists; score now reflects proof strength
	| 'beta_ready' //      locally proven and ready for live human beta testing
	| 'live_validation' // live human/user-thread proof is accumulating
	| 'complete' //        repeatedly successful live usage; no known launch blocker

export type ScopeProgressItemStatus =
	| 'done'
	| 'partial'
	| 'planned'
	| 'blocked'
	| 'deferred'
	| 'out_of_scope'

export type ScopeProgressItem = {
	id: string
	label: string
	status: ScopeProgressItemStatus
	note?: string
	evidenceRef?: string
}

export type ScopeProgressLiveProof = {
	successfulThreads?: number
	successfulUsers?: number
	targetThreads?: number
	targetUsers?: number
	evidenceRef?: string
}

export type ScopeProgressMetadata = {
	stage: ScopeProgressStage
	scopeRef?: string
	currentScope?: ScopeProgressItem[]
	deferred?: ScopeProgressItem[]
	outOfScope?: ScopeProgressItem[]
	liveProof?: ScopeProgressLiveProof
	note?: string
}

export type Workflow = {
	id: string
	label: string
	lifecycle: Lifecycle
	health?: Health //  override; else derived from lifecycle
	note?: string
	coverage?: Coverage
}

export type UserIntent = {
	id: string
	label: string //    the user-facing intent, e.g. "Search my notes"
	lifecycle: Lifecycle
	health?: Health
	note?: string
	lane?: string //    a join key the live coverage overlay matches signals on
	workflows?: Workflow[]
	coverage?: Coverage
}

export type LedgerFeature = {
	id: string
	label: string
	areaId: string
	lifecycle: Lifecycle
	health?: Health //          override; else derived from lifecycle
	summary?: string //         "what it does" — the intent-map intro
	prd?: string[] //           provenance: spec / design docs the status was mined from
	featureHealthId?: string // links to an external runtime-health feed id, if one tracks it
	intents?: UserIntent[] //   the drill-deep view
	coveredChildIds?: string[] // network edge: feature ids this one wraps/covers (wrappers, spines)
	gaps?: string[] //          documented unknowns to confirm
	progress?: ScopeProgressMetadata // PRD/spec scope-completion scoring, separate from working-now health
}

export type LedgerArea = {
	id: string
	label: string
	summary?: string
	order?: number
}

export type Ledger = {
	generatedAt?: string
	areas: LedgerArea[]
	features: LedgerFeature[]
}
