import type { RunTarget } from './runner'

// The typed, serializable definition contract — the thing a renderer draws.
// `StatusMapDefinition` is plain JSON (meta + a list of typed sections), so the same definition can be a
// code module, an HTTP response, or a stored document, and any renderer (the Vue family, a CLI, your own)
// can draw it. No map *content* lives here; producers (hand-authored modules or generators) build it.
//
// Governance: the section-`kind` union is the single extension point and is CLOSED at each `schemaVersion`.
// Add a kind deliberately (new component + registry entry + union member + a schemaVersion bump), never
// ad-hoc per-map. The *producer* may change freely; the *renderer contract* grows on purpose.

// ── Tone: the single status vocabulary the components color ──────────────────
// `statusTone(tone)` (tone.ts) is the ONE place a tone resolves to a palette token.
export type StatusTone =
	| 'live'
	| 'beta'
	| 'built'
	| 'planned' //                               capability / roadmap vocab
	| 'green'
	| 'yellow'
	| 'red'
	| 'blocked'
	| 'stale'
	| 'unknown' // health vocab
	| 'neutral'

export type Chip = { label: string; tone?: StatusTone; mono?: boolean; title?: string }
export type StatusBadge = { label: string; tone: StatusTone; mono?: boolean; pulse?: boolean }

export type StatusMapMeta = {
	id: string //                                  stable map id = route key, e.g. 'overview' | 'feature-x'
	eyebrow?: string
	title: string
	subtitle?: string
	source?: 'hand_authored' | 'generated' //      which kind of producer built this definition
	generatedAt?: string //                        ISO; when THIS definition was built
	sourceGeneratedAt?: string //                  ISO; the source data's own timestamp
	sourceHash?: string //                         hash of the source data — lets a consumer detect staleness
	badges?: StatusBadge[] //                      live-status chips in the header
}

// ── Sections: discriminated union on `kind` ──────────────────────────────────
type SectionBase = {
	id?: string
	num?: string
	title?: string
	subtitle?: string
	tone?: 'page' | 'card'
}

export type HeaderSection = SectionBase & {
	kind: 'header'
	badges?: StatusBadge[]
	chips?: Chip[]
	note?: string
}

export type LegendItem = { tone: StatusTone; label: string; hint?: string }
export type LegendSection = SectionBase & {
	kind: 'legend'
	items: LegendItem[]
	filters?: boolean // tap-to-filter the page's `cards` items by tone
}

// A rollup summary shown on a parent grouping node: "what's the status inside it" — a health % plus
// per-tone counts (deferred / not-built items count as down, so the % tells the truth).
export type ToneCount = { tone: StatusTone; count: number }
export type RollupSummary = { healthPct: number; total: number; counts: ToneCount[] }
export type ScopeProgressNodeSummary = {
	percent: number
	label: string
	tone: StatusTone
	inferred?: boolean
}

export type FlowNode = {
	id: string
	title: string
	body?: string
	tone?: StatusTone
	lanes?: Chip[]
	to?: string //              drill target (explorer URL / anchor) — renders the node as a link
	rollup?: RollupSummary //   parent grouping: a brief summary of the statuses inside it
	scopeProgress?: ScopeProgressNodeSummary // PRD/spec scope-completion summary, separate from health
	statusLabel?: string //     short status word under the title (e.g. 'Live', 'Not built')
	run?: RunTarget //          optional live-run target; renderers hide it unless a runner is provided
}
export type FlowEdge = { from: string; to: string; label?: string }
// `pipeline` (default) draws arrows between consecutive nodes (a process flow).
// `grid` lays nodes out as a wrapping grid of clickable grouping cards (the explorer's flowchart levels).
export type FlowSection = SectionBase & {
	kind: 'flow'
	nodes: FlowNode[]
	edges?: FlowEdge[]
	layout?: 'pipeline' | 'grid'
}

export type StatusCardNote = { marker: string; text: string }
// A one-glance verdict chip shown in the collapsed accordion row (derived by the producer, not authored).
export type StatusCardVerdict = { label: string; tone: StatusTone }
// A node in the rendered test-ledger tree (suite → describe-stage → test → e2e step). `verdict` is the
// rolled-up pill; `passing` lets the renderer fold all-green branches into a "✓ N passing" line;
// `counts` (descendant-leaf tallies) drives the group badge + the fold count. Recursive via children.
export type StatusCardTreeNode = {
	name: string
	file?: string
	verdict: StatusCardVerdict
	passing: boolean
	counts: { passed: number; failed: number; skipped: number }
	children?: StatusCardTreeNode[]
	run?: RunTarget
}
export type StatusCard = {
	name: string
	tone: StatusTone
	statusLabel?: string
	intent?: string //                       the "what it does" line
	meta?: Chip[] //                         scope / owner chips (a generator may put workflows here)
	note?: StatusCardNote //                 the ¹ footnote pattern (tooltip)
	group?: string //                        filter/group key
	to?: string //                           optional drill target — renders the card as a link
	coverage?: Chip[] //                     test-coverage chips (proof level / owning e2e / matrix / last run)
	tested?: StatusCardVerdict //            collapsed-row "how well tested" verdict (✓ proven / ~ heuristic / ✗ failing / — untested)
	blocking?: StatusCardVerdict //          collapsed-row "is anything blocking it" flag; absent = nothing blocks it
	blockers?: string[] //                   the specific blocker lines (expanded body); pairs with `blocking`
	testTree?: StatusCardTreeNode[] //       the navigable test-ledger tree (expanded body), failing-first
	run?: RunTarget
}
export type CardsSection = SectionBase & { kind: 'cards'; items: StatusCard[] }

export type LadderRung = { label: string; detail?: string; tone?: StatusTone }
export type LadderSection = SectionBase & { kind: 'ladder'; rungs: LadderRung[] }

export type MatrixCell = { tone: StatusTone; text?: string; note?: string }
export type MatrixRow = { label: string; cells: MatrixCell[] }
export type MatrixSection = SectionBase & { kind: 'matrix'; columns: string[]; rows: MatrixRow[] }

export type TimelineStep = {
	rank?: string
	title: string
	body?: string
	tag?: { label: string; tone?: StatusTone }
	current?: boolean
}
export type TimelineSection = SectionBase & { kind: 'timeline'; steps: TimelineStep[] }

// `tone` is overridden to StatusTone (panels carry a status color, not the shell's page/card layout tone).
// Must Omit SectionBase.tone first: a plain intersection would AND the two tone types to `never`.
export type PanelSection = Omit<SectionBase, 'tone'> & {
	kind: 'panel'
	tone?: StatusTone
	body?: string
	chips?: Chip[]
	bullets?: string[]
}

export type StatusMapSection =
	| HeaderSection
	| LegendSection
	| FlowSection
	| CardsSection
	| LadderSection
	| MatrixSection
	| TimelineSection
	| PanelSection

export type StatusMapSectionKind = StatusMapSection['kind']

export type StatusMapDefinition = {
	schemaVersion: 1 // bump only on a contract change; the renderer stays boring
	meta: StatusMapMeta
	sections: StatusMapSection[]
}
