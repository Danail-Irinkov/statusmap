// Generators — project a ledger into StatusMapDefinitions for a drill-down explorer's three levels:
//   overview (L1 grid of areas)  →  area (L2 grid of features)  →  feature (deep drill).
// Plus `ledgerToFlat` (every feature expanded on one page). Nothing here is map content; it is a
// projection of the ledger. The heuristics come from DEFAULT_STATUS_RULES; copy/brand from GeneratorOptions.

import type {
	Chip,
	FlowNode,
	StatusBadge,
	StatusCard,
	StatusCardTreeNode,
	StatusCardVerdict,
	StatusMapDefinition,
	StatusTone,
} from '../types'
import type { RunTarget } from '../runner'
import { DEFAULT_STATUS_RULES as RULES } from '../status-rules'
import { statusTone } from '../tone'
import type { Coverage, Ledger, LedgerFeature, TestNode, TestStatus, UserIntent } from './types'
import {
	featureHealth,
	featureTone,
	intentHealth,
	lifecycleLabel,
	lifecycleTone,
	rollupFeatures,
	rollupTone,
	workflowHealth,
} from './rollup'
import {
	featureScopeProgress,
	rollupScopeProgress,
	scopeProgressTone,
	type ScopeProgressRollupSummary,
	type ScopeProgressSummary,
} from './progress'

export type GeneratorOptions = {
	basePath?: string // the explorer's base route, e.g. '/status-map'. Drill links are `${basePath}?area=…`.
	brand?: string //    optional product name shown in eyebrows/titles (e.g. 'Acme'); omitted = none.
	// Noun for the L2 tier — default 'feature'/'features'. A consumer whose domain calls these "modules"
	// (e.g. an ERP/MIS) passes { one: 'module', many: 'modules' } so every L2 label reads that way. Other
	// maps that don't set it are unchanged.
	featureNoun?: { one: string; many: string }
}

const DEFAULT_BASE = '/status-map'
const DEFAULT_FEATURE_NOUN = { one: 'feature', many: 'features' }
const nounOf = (opts: GeneratorOptions) => opts.featureNoun ?? DEFAULT_FEATURE_NOUN
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

const withBrandEyebrow = (brand: string | undefined, suffix: string) =>
	brand ? `${brand} · ${suffix}` : suffix
const withBrandTitle = (brand: string | undefined, suffix: string) =>
	brand ? `${brand} — ${suffix}` : suffix

function areaUrl(base: string, areaId: string) {
	return `${base}?area=${encodeURIComponent(areaId)}`
}
function featureUrl(base: string, areaId: string, featureId: string) {
	return `${base}?area=${encodeURIComponent(areaId)}&feature=${encodeURIComponent(featureId)}`
}

function coverageRunSpecs(c?: Coverage): string[] {
	return [c?.owningE2e].filter((s): s is string => !!s && !!s.trim())
}

function featureSpecs(f: LedgerFeature): string[] {
	return [...new Set((f.intents || []).flatMap((i) => coverageRunSpecs(i.coverage)))]
}

function runTarget(input: RunTarget): RunTarget | undefined {
	return input.specs.length ? input : undefined
}

function featuresOf(ledger: Ledger, areaId: string): LedgerFeature[] {
	return ledger.features.filter((f) => f.areaId === areaId)
}

// A rollup → compact badges: working-now health, optional PRD/spec scope progress, then tone counts.
function rollupBadges(
	summary: ReturnType<typeof rollupFeatures>,
	scope?: ScopeProgressRollupSummary,
): StatusBadge[] {
	const badges: StatusBadge[] = [{ label: `Working now: ${summary.healthPct}%`, tone: rollupTone(summary) }]
	if (scope) {
		badges.push({ label: `Scope complete: ${scope.percent}%`, tone: scope.tone })
	}
	for (const c of summary.counts) {
		badges.push({ label: `${c.count} ${statusTone(c.tone).label.toLowerCase()}`, tone: c.tone })
	}
	return badges
}

function nodeScopeProgress(summary: ScopeProgressSummary) {
	return {
		percent: summary.percent,
		label: 'Scope complete',
		tone: summary.tone,
		inferred: summary.inferred,
	}
}

function rollupNodeScopeProgress(summary: ScopeProgressRollupSummary) {
	return {
		percent: summary.percent,
		label: 'Scope complete',
		tone: summary.tone,
		inferred: summary.inferred,
	}
}

// ── Level 1: overview — a grid flowchart of areas, each with its rollup ───────────────────────────
export function ledgerToOverview(ledger: Ledger, opts: GeneratorOptions = {}): StatusMapDefinition {
	const base = opts.basePath ?? DEFAULT_BASE
	const overall = rollupFeatures(ledger.features)
	const overallScope = rollupScopeProgress(ledger.features)
	const areas = [...ledger.areas].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

	const nodes: FlowNode[] = areas.map((area) => {
		const areaFeatures = featuresOf(ledger, area.id)
		const summary = rollupFeatures(areaFeatures)
		const scope = rollupScopeProgress(areaFeatures)
		return {
			id: area.id,
			title: area.label,
			body: area.summary,
			tone: rollupTone(summary),
			to: areaUrl(base, area.id),
			rollup: summary,
			scopeProgress: rollupNodeScopeProgress(scope),
			statusLabel: `${summary.total} ${summary.total === 1 ? nounOf(opts).one : nounOf(opts).many}`,
		}
	})

	return {
		schemaVersion: 1,
		meta: {
			id: 'ledger-overview',
			eyebrow: withBrandEyebrow(opts.brand, 'Status tree'),
			title: withBrandTitle(opts.brand, 'Status map'),
			// No subtitle on the landing view — the boilerplate "every area … click to drill in" explainer was
			// redundant with the map itself. Area/feature views keep their meaningful summary as the subtitle.
			source: 'generated',
			generatedAt: ledger.generatedAt,
			badges: rollupBadges(overall, overallScope),
		},
		sections: [
			{
				kind: 'flow',
				num: '01',
				title: 'Areas',
				subtitle: 'Each card rolls up the statuses inside it.',
				layout: 'grid',
				nodes,
			},
			// The legend is a static colour key — kept at the BOTTOM as a reference (all tap-to-filter lives
			// in the explorer's filter bar now; PRD §6.6 / D-006).
			{ kind: 'legend', title: 'Legend', items: RULES.legend },
		],
	}
}

// ── Level 2: area — a grid flowchart of the area's features ───────────────────────────────────────
export function ledgerToArea(
	ledger: Ledger,
	areaId: string,
	opts: GeneratorOptions = {},
): StatusMapDefinition | null {
	const base = opts.basePath ?? DEFAULT_BASE
	const area = ledger.areas.find((a) => a.id === areaId)
	if (!area) {
		return null
	}
	const features = featuresOf(ledger, areaId)
	const summary = rollupFeatures(features)
	const scopeSummary = rollupScopeProgress(features)

	const nodes: FlowNode[] = features.map((f) => {
		const scope = featureScopeProgress(f)
		const intentRollup = f.intents?.length
			? {
					healthPct: Math.round(
						f.intents.reduce((s, i) => {
							const h = intentHealth(i)
							return s + (h === 'up' ? 100 : h === 'partial' ? 50 : 0)
						}, 0) / f.intents.length,
					),
					total: f.intents.length,
					counts: [],
				}
			: undefined
		return {
			id: f.id,
			title: f.label,
			body: f.summary,
			tone: featureTone(f),
			to: featureUrl(base, areaId, f.id),
			statusLabel: lifecycleLabel(f.lifecycle),
			rollup: f.intents?.length ? intentRollup : undefined,
			scopeProgress: nodeScopeProgress(scope),
			run: runTarget({ level: 'feature', featureId: f.id, specs: featureSpecs(f), label: f.label, watch: true }),
		}
	})

	return {
		schemaVersion: 1,
		meta: {
			id: `ledger-area-${areaId}`,
			eyebrow: withBrandEyebrow(opts.brand, 'Area'),
			title: area.label,
			subtitle: area.summary,
			source: 'generated',
			generatedAt: ledger.generatedAt,
			badges: rollupBadges(summary, scopeSummary),
		},
		sections: [
			{
				kind: 'flow',
				num: '01',
				title: capitalize(nounOf(opts).many),
				subtitle: `Click a ${nounOf(opts).one} for its user intents and workflow statuses.`,
				layout: 'grid',
				nodes,
			},
		],
	}
}

// ── Level 3: feature — the deep drill: intent map + user-intent / workflow statuses ───────────────
// Project a Coverage record into display chips: proof level (tinted by passing), owning e2e, matrix, run.
function coverageChips(c?: Coverage): Chip[] {
	if (!c) {
		return []
	}
	const chips: Chip[] = []
	if (c.proofLevel) {
		const tone: StatusTone =
			c.passing === false
				? 'red'
				: c.proofLevel === 'destination' || c.proofLevel === 'owning_e2e'
					? 'live'
					: c.proofLevel === 'none'
						? 'planned'
						: 'yellow'
		chips.push({ label: c.proofLevel, tone })
	}
	if (c.owningE2e) {
		chips.push({ label: `e2e: ${c.owningE2e}`, mono: true, title: c.owningE2e })
	}
	if (c.matrix) {
		chips.push({ label: `matrix: ${c.matrix}`, mono: true, title: c.matrix })
	}
	if (c.lastRun) {
		chips.push({ label: c.lastRun, mono: true })
	}
	return chips
}

// Provenance chips for a feature: lifecycle (toned) + external-feed link + the docs the status was mined from.
function featureProvenanceChips(f: LedgerFeature): Chip[] {
	return [
		{ label: lifecycleLabel(f.lifecycle), tone: featureTone(f) },
		...(f.featureHealthId ? [{ label: `feed: ${f.featureHealthId}`, mono: true }] : []),
		...(f.prd || []).map((p) => ({ label: p, mono: true })),
	]
}

// Derive the one-glance "how well tested" verdict from the intent's coverage (proofLevel + passing).
// A heuristic is inherently weak proof, so it reads yellow regardless of the passing bit; a real e2e/unit
// whose last run failed reads red; a passing destination/owning_e2e reads green; no proof reads neutral.
export function testedVerdict(c?: Coverage): StatusCardVerdict {
	if (!c || !c.proofLevel || c.proofLevel === 'none') {
		return { label: '— Untested', tone: 'neutral' }
	}
	if (c.proofLevel === 'heuristic') {
		return { label: '~ Heuristic', tone: 'yellow' }
	}
	if (c.passing === false) {
		return { label: '✗ Failing', tone: 'red' }
	}
	if (c.proofLevel === 'destination' || c.proofLevel === 'owning_e2e') {
		return { label: '✓ Proven', tone: 'live' }
	}
	return { label: '✓ Tested', tone: 'live' } // unit + passing
}

// The specific blockers tied to ONE intent: any down workflow (with or without a note) + any partial
// workflow that documents WHY. The intent's own `note` is shown as the item's description line.
export function intentBlockers(intent: UserIntent): string[] {
	const out: string[] = []
	for (const w of intent.workflows || []) {
		const h = workflowHealth(w)
		if (h === 'down') {
			out.push(w.note ? `${w.label}: ${w.note}` : `${w.label} — not built / down`)
		} else if (h === 'partial' && w.note) {
			out.push(`${w.label}: ${w.note}`)
		}
	}
	return out
}

// The collapsed-row blocking flag, derived from lifecycle + health + the blocker list. Returns undefined
// when nothing blocks the item — a clean intent shows NO flag, so the flag's presence is itself the signal.
export function blockingFlag(intent: UserIntent, blockers: string[]): StatusCardVerdict | undefined {
	if (intent.lifecycle === 'not_built' || intent.lifecycle === 'planned') {
		return { label: '⚠ Not built', tone: 'planned' }
	}
	if (intentHealth(intent) === 'down') {
		return { label: '⚠ Blocked', tone: 'red' }
	}
	if (blockers.length) {
		return {
			label: blockers.length === 1 ? '⚠ 1 blocker' : `⚠ ${blockers.length} blockers`,
			tone: 'yellow',
		}
	}
	return undefined
}

// One test status → its pill.
function nodeVerdict(status: TestStatus): StatusCardVerdict {
	if (status === 'failed') return { label: '✗ Fail', tone: 'red' }
	if (status === 'skipped') return { label: '○ Skipped', tone: 'neutral' }
	return { label: '✓ Pass', tone: 'live' }
}

const nodeRank = (s: TestStatus) => (s === 'failed' ? 0 : s === 'skipped' ? 1 : 2) // fail → skip → pass
const countOneStatus = (s: TestStatus) => ({
	passed: s === 'passed' ? 1 : 0,
	failed: s === 'failed' ? 1 : 0,
	skipped: s === 'skipped' ? 1 : 0,
})

// Map a ledger TestNode → a render node, children sorted FAILING-FIRST so the explorer floats reds up.
function mapTreeNode(n: TestNode, featureId: string | undefined, fallbackSpecs: string[]): StatusCardTreeNode {
	const children = n.children?.length
		? [...n.children]
				.sort((a, b) => nodeRank(a.status) - nodeRank(b.status) || a.name.localeCompare(b.name))
				.map((child) => mapTreeNode(child, featureId, fallbackSpecs))
		: undefined
	const specs = n.file ? [typeof n.line === 'number' ? `${n.file}:${n.line}` : n.file] : fallbackSpecs
	const level = typeof n.line === 'number' || !children ? 'test' : 'spec'
	return {
		name: n.name,
		file: n.file,
		verdict: nodeVerdict(n.status),
		passing: n.status === 'passed',
		counts: n.counts,
		...(children ? { children } : {}),
		run: runTarget({
			level,
			featureId,
			specs,
			label: n.name,
			watch: true,
		}),
	}
}

// The intent's test-ledger tree for the explorer: the ingested run tree if present, else the hand-authored
// flat cases as a one-level tree. Top nodes failing-first.
function coverageTree(c?: Coverage, featureId?: string): StatusCardTreeNode[] | undefined {
	let nodes: TestNode[] | undefined
	if (c?.testTree?.length) {
		nodes = c.testTree
	} else if (c?.tests?.length) {
		nodes = c.tests.map((t) => {
			const status: TestStatus = t.skipped ? 'skipped' : t.passing ? 'passed' : 'failed'
			return { name: t.name, file: t.file, status, counts: countOneStatus(status) }
		})
	}
	if (!nodes?.length) return undefined
	const specs = coverageRunSpecs(c)
	return [...nodes]
		.sort((a, b) => nodeRank(a.status) - nodeRank(b.status) || a.name.localeCompare(b.name))
		.map((n) => mapTreeNode(n, featureId, specs))
}

export function intentToCard(intent: UserIntent, featureId?: string): StatusCard {
	const tone = lifecycleTone(intent.lifecycle, intent.health)
	const blockers = intentBlockers(intent)
	const specs = coverageRunSpecs(intent.coverage)
	return {
		name: intent.label,
		tone,
		statusLabel: lifecycleLabel(intent.lifecycle),
		intent: intent.note,
		meta: (intent.workflows || []).map((w) => ({
			label: w.label,
			tone: lifecycleTone(w.lifecycle, w.health),
			title: w.note,
		})),
		coverage: coverageChips(intent.coverage),
		tested: testedVerdict(intent.coverage),
		blocking: blockingFlag(intent, blockers),
		blockers: blockers.length ? blockers : undefined,
		testTree: coverageTree(intent.coverage, featureId),
		run: runTarget({ level: 'spec', featureId, specs, label: intent.label, watch: true }),
	}
}

// A gap entry that documents an INTENTIONAL scope boundary — a deliberate non-feature or a
// decision-deferred item — rather than an unverified gap to chase down. These render in a calm
// "By design / out of scope" panel instead of the yellow "Gaps to confirm" warning, so a reader can
// tell "we chose not to build this" from "this might be broken". Detected by a leading marker the
// ledger uses by convention (for example storefront upload-artwork / product-apparel / checkout-order
// gaps): "By design ...", "Deferred ...", "Out of scope ...".
const BY_DESIGN_NOTE = /^\s*(by design|deferred|out of scope|out-of-scope)\b/i
function splitGaps(gaps: string[]): { toConfirm: string[]; byDesign: string[] } {
	const byDesign = gaps.filter((g) => BY_DESIGN_NOTE.test(g))
	const toConfirm = gaps.filter((g) => !BY_DESIGN_NOTE.test(g))
	return { toConfirm, byDesign }
}

export function ledgerToFeatureDetail(
	ledger: Ledger,
	featureId: string,
	opts: GeneratorOptions = {},
): StatusMapDefinition | null {
	const f = ledger.features.find((x) => x.id === featureId)
	if (!f) {
		return null
	}
	const area = ledger.areas.find((a) => a.id === f.areaId)
	const tone: StatusTone = featureTone(f)
	const scope = featureScopeProgress(f)

	const provenanceChips = featureProvenanceChips(f)

	const sections: StatusMapDefinition['sections'] = [
		{
			kind: 'panel',
			num: '01',
			title: 'Intent map',
			tone,
			body: f.summary || 'No summary yet.',
			chips: provenanceChips,
		},
	]

	if (f.intents?.length) {
		sections.push({
			kind: 'cards',
			num: '02',
			title: 'User intents & workflows',
			subtitle: 'Each intent shows its workflows as status-coded chips.',
			items: f.intents.map((intent) => intentToCard(intent, f.id)),
		})
	} else {
		sections.push({
			kind: 'panel',
			num: '02',
			title: 'User intents & workflows',
			tone: 'planned',
			body: `No user intents declared yet for this ${nounOf(opts).one} — a gap to fill in the ledger.`,
		})
	}

	if (f.gaps?.length) {
		const { toConfirm, byDesign } = splitGaps(f.gaps)
		if (toConfirm.length) {
			sections.push({
				kind: 'panel',
				num: '03',
				title: 'Gaps to confirm',
				tone: 'yellow',
				body: 'Reused from existing sources — please confirm or correct:',
				bullets: toConfirm,
			})
		}
		if (byDesign.length) {
			// Calm, un-toned panel: intentional scope, not a warning. Takes slot 04 when it follows
			// the yellow gaps panel, else it occupies 03.
			sections.push({
				kind: 'panel',
				num: toConfirm.length ? '04' : '03',
				title: 'By design / out of scope',
				body: 'Intentional scope decisions — not gaps to fix:',
				bullets: byDesign,
			})
		}
	}

	const fh = featureHealth(f)
	const healthBadge: StatusBadge = {
		label: `Working now: ${fh === 'up' ? 'Up' : fh === 'partial' ? 'Partial' : 'Down'}`,
		tone,
	}
	const scopeBadge: StatusBadge = {
		label: `Scope complete: ${scope.percent}%`,
		tone: scopeProgressTone(scope),
	}

	return {
		schemaVersion: 1,
		meta: {
			id: `ledger-feature-${featureId}`,
			eyebrow: area
				? withBrandEyebrow(opts.brand, area.label)
				: withBrandEyebrow(opts.brand, capitalize(nounOf(opts).one)),
			title: f.label,
			subtitle: f.summary,
			source: 'generated',
			generatedAt: ledger.generatedAt,
			badges: [healthBadge, scopeBadge],
		},
		sections,
	}
}

// ── Flat: every feature's full intent map on ONE page, grouped by area (no drilling) ──────────────
export function ledgerToFlat(ledger: Ledger, opts: GeneratorOptions = {}): StatusMapDefinition {
	const overall = rollupFeatures(ledger.features)
	const overallScope = rollupScopeProgress(ledger.features)
	const areas = [...ledger.areas].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

	const sections: StatusMapDefinition['sections'] = []

	areas.forEach((area, ai) => {
		const features = featuresOf(ledger, area.id)
		// Area band: a header divider with the area rollup; `id` is the jump-bar anchor target.
		sections.push({
			kind: 'header',
			id: `area-${area.id}`,
			num: String(ai + 1).padStart(2, '0'),
			title: area.label,
			subtitle: area.summary,
			tone: 'card',
			badges: rollupBadges(rollupFeatures(features), rollupScopeProgress(features)),
		})
		// Each feature, fully expanded: lead panel (intent-map intro + provenance) → intents/workflows → gaps.
		for (const f of features) {
			sections.push({
				kind: 'panel',
				id: `feature-${f.id}`,
				title: f.label,
				tone: featureTone(f),
				body: f.summary || 'No summary yet.',
				chips: featureProvenanceChips(f),
			})
			if (f.intents?.length) {
				sections.push({ kind: 'cards', items: f.intents.map((intent) => intentToCard(intent, f.id)) })
			} else {
				sections.push({
					kind: 'panel',
					tone: 'planned',
					body: `No user intents declared yet for this ${nounOf(opts).one} — a gap to fill in the ledger.`,
				})
			}
			if (f.gaps?.length) {
				const { toConfirm, byDesign } = splitGaps(f.gaps)
				if (toConfirm.length) {
					sections.push({ kind: 'panel', tone: 'yellow', body: 'Gaps to confirm:', bullets: toConfirm })
				}
				if (byDesign.length) {
					sections.push({ kind: 'panel', body: 'By design / out of scope:', bullets: byDesign })
				}
			}
		}
	})

	// The legend is a static colour key — appended at the BOTTOM as a reference (PRD §6.6 / D-006).
	sections.push({ kind: 'legend', title: 'Legend', items: RULES.legend })

	return {
		schemaVersion: 1,
		meta: {
			id: 'ledger-flat',
			eyebrow: withBrandEyebrow(opts.brand, 'Status tree'),
			title: withBrandTitle(opts.brand, 'Status map (All)'),
			subtitle:
				`Every ${nounOf(opts).one}’s full intent map on one page — user intents, workflows and test coverage, ` +
				'grouped by area. No drilling needed; switch to Explore for the click-through view.',
			source: 'generated',
			generatedAt: ledger.generatedAt,
			badges: rollupBadges(overall, overallScope),
		},
		sections,
	}
}

// ── QA scan: every capability on ONE page with a single plain-language status, for a tester ───────
// Collapses lifecycle × health × proof into one legible verdict — "what works now" at a glance, problems
// first. Composed from existing section kinds (legend + header + cards); no new render-DSL kind.
type QaState = 'broken' | 'untested' | 'unproven' | 'beta' | 'prelive' | 'live' | 'notbuilt'

const QA_META: Record<QaState, { label: string; tone: StatusTone; order: number; plain: string; hint: string }> = {
	broken: { label: '🔴 Broken', tone: 'red', order: 0, plain: 'broken', hint: 'A real test for it is currently failing.' },
	untested: { label: '❓ Untested', tone: 'yellow', order: 1, plain: 'untested', hint: 'Built, but nothing proves it works yet.' },
	unproven: { label: '🟡 Built · unproven', tone: 'yellow', order: 2, plain: 'built, unproven', hint: 'Built, only a weak/heuristic check so far.' },
	beta: { label: '🧪 Beta-test ready', tone: 'beta', order: 3, plain: 'beta-test ready', hint: 'Limited working path with real proof; not live-ready.' },
	prelive: { label: '🟢 Proven · not live yet', tone: 'live', order: 4, plain: 'proven, pre-live', hint: 'Implemented + proven, not shipped to prod.' },
	live: { label: '✅ Live & working', tone: 'live', order: 5, plain: 'live & working', hint: 'Shipped + proven by a test or a human.' },
	notbuilt: { label: '⚪ Not built', tone: 'planned', order: 6, plain: 'not built', hint: 'Planned or not implemented yet.' },
}

function qaStateOf(lifecycle: UserIntent['lifecycle'], coverage?: Coverage): QaState {
	if (lifecycle === 'planned' || lifecycle === 'not_built' || lifecycle === 'deferred' || lifecycle === 'unknown') {
		return 'notbuilt'
	}
	if (coverage?.passing === false) {
		return 'broken'
	}
	const pl = coverage?.proofLevel
	if (!pl || pl === 'none') {
		return 'untested'
	}
	if (pl === 'heuristic') {
		return 'unproven'
	}
	if (lifecycle === 'beta') {
		return 'beta'
	}
	return lifecycle === 'live' ? 'live' : 'prelive'
}

// The one-glance QA verdict for an intent — exported so other producers/consumers can reuse it.
export function qaVerdict(intent: UserIntent): StatusCardVerdict {
	const m = QA_META[qaStateOf(intent.lifecycle, intent.coverage)]
	return { label: m.label, tone: m.tone }
}

export function ledgerToQaScan(ledger: Ledger, opts: GeneratorOptions = {}): StatusMapDefinition {
	const areas = [...ledger.areas].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

	// Tally every intent (or an intent-less feature, by its own lifecycle) into the six buckets.
	const tally: Record<QaState, number> = { broken: 0, untested: 0, unproven: 0, beta: 0, prelive: 0, live: 0, notbuilt: 0 }
	for (const f of ledger.features) {
		const intents = f.intents || []
		if (!intents.length) {
			tally[qaStateOf(f.lifecycle, undefined)]++
		} else {
			for (const i of intents) tally[qaStateOf(i.lifecycle, i.coverage)]++
		}
	}

	// Headline tally, most-reassuring-first (live → … → not built); only non-zero buckets.
	const tallyOrder: QaState[] = ['live', 'beta', 'prelive', 'broken', 'untested', 'unproven', 'notbuilt']
	const badges: StatusBadge[] = tallyOrder
		.filter((s) => tally[s] > 0)
		.map((s) => ({ label: `${tally[s]} ${QA_META[s].plain}`, tone: QA_META[s].tone }))

	const sections: StatusMapDefinition['sections'] = [
		{
			kind: 'header',
			num: '01',
			title: 'What works now',
			subtitle: 'Every capability with one plain status — broken and untested float to the top of each area. Open a row for its proof.',
			badges,
		},
	]

	areas.forEach((area, ai) => {
		const features = featuresOf(ledger, area.id)
		const rows: Array<{ order: number; card: StatusCard }> = []
		for (const f of features) {
			const intents = f.intents || []
			if (!intents.length) {
				const st = qaStateOf(f.lifecycle, undefined)
				rows.push({
					order: QA_META[st].order,
					card: { name: f.label, tone: QA_META[st].tone, statusLabel: QA_META[st].label, intent: f.summary },
				})
				continue
			}
			for (const i of intents) {
				const st = qaStateOf(i.lifecycle, i.coverage)
				rows.push({
					order: QA_META[st].order,
					card: {
						name: i.label,
						tone: QA_META[st].tone,
						statusLabel: QA_META[st].label,
						intent: `in ${f.label}${i.note ? ` — ${i.note}` : ''}`,
						coverage: coverageChips(i.coverage),
						group: area.id,
					},
				})
			}
		}
		rows.sort((a, b) => a.order - b.order || a.card.name.localeCompare(b.card.name))
		sections.push({
			kind: 'header',
			id: `area-${area.id}`,
			num: String(ai + 1).padStart(2, '0'),
			title: area.label,
			subtitle: area.summary,
			tone: 'card',
		})
		sections.push({ kind: 'cards', items: rows.map((r) => r.card) })
	})

	// The status key is a static reference — appended at the BOTTOM (PRD §6.6 / D-006).
	sections.push({
		kind: 'legend',
		title: 'What each status means',
		items: (['live', 'beta', 'prelive', 'broken', 'untested', 'unproven', 'notbuilt'] as QaState[]).map((s) => ({
			tone: QA_META[s].tone,
			label: QA_META[s].label,
			hint: QA_META[s].hint,
		})),
	})

	return {
		schemaVersion: 1,
		meta: {
			id: 'ledger-qa',
			eyebrow: withBrandEyebrow(opts.brand, 'QA scan'),
			title: withBrandTitle(opts.brand, 'What works now'),
			subtitle:
				'A tester’s-eye view: every capability with a single plain-language status, problems first. ' +
				'Open a row for its proof.',
			source: 'generated',
			generatedAt: ledger.generatedAt,
			badges,
		},
		sections,
	}
}
