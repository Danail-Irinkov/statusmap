// The unified, framework-neutral status-map filter (PRD §6.6 / D-006). ONE state shape + ONE predicate that
// every renderer (Vue, React, …) binds to its own reactivity in ~15 lines — that is the parity guarantee
// made structural. Supersedes the two divergent filters this library shipped (the Vue legend tone-tap and
// the core `ReviewFilter`); `review-filter.ts` re-exports these names so existing importers compile unchanged.
//
// HONESTY (PRD G2/G3): the filter only HIDES nodes. It never recomputes tone / health / proof — it reads the
// SAME `lifecycleTone` + `intentVerdictCategories` every card already shows, so a filtered view can never
// disagree with an unfiltered one about a node's status.
//
// Four composable dimensions, OR-within a dimension and AND-across dimensions; EVERY dimension empty =
// INACTIVE = the full map (preserves the no-filter / no-JS default).

import type { StatusTone } from '../types'
import type { Ledger, LedgerFeature, UserIntent } from './types'
import { featureTone, intentHealth, lifecycleTone } from './rollup'
import { intentBlockers } from './generators'

// ── Verdict axis ──────────────────────────────────────────────────────────────────────────────────
// An intent's verdict categories — it can be several at once (e.g. failing AND blocked). Mirrors the
// testedVerdict + blockingFlag derivations so the filter agrees with what each card shows.
export type VerdictCategory = 'proven' | 'heuristic' | 'failing' | 'untested' | 'blocked' | 'not_built'

export function intentVerdictCategories(intent: UserIntent): VerdictCategory[] {
	const cats: VerdictCategory[] = []
	const c = intent.coverage
	// tested axis
	if (!c || !c.proofLevel || c.proofLevel === 'none') cats.push('untested')
	else if (c.proofLevel === 'heuristic') cats.push('heuristic')
	else if (c.passing === false) cats.push('failing')
	else cats.push('proven')
	// blocking axis
	if (intent.lifecycle === 'not_built' || intent.lifecycle === 'planned') cats.push('not_built')
	else if (intentHealth(intent) === 'down') cats.push('blocked')
	else if (intentBlockers(intent).length) cats.push('blocked')
	return cats
}

// Tones that mean "not done" — the one-tap review preset. Everything except live/green.
export const NEEDS_ATTENTION_TONES: StatusTone[] = [
	'beta',
	'yellow',
	'red',
	'blocked',
	'stale',
	'planned',
	'unknown',
]

// The verdict categories worth surfacing for review, in display order (proven is "done", so it is not a
// review chip — but it is still a valid category the filter accepts).
export const REVIEW_VERDICTS: VerdictCategory[] = [
	'untested',
	'heuristic',
	'failing',
	'blocked',
	'not_built',
]

// ── State ───────────────────────────────────────────────────────────────────────────────────────────
// Four composable dimensions. OR-within (a value matches iff it is one of the selected) and AND-across (a
// node must satisfy every NON-EMPTY dimension). Every dimension empty/absent = inactive = the full map.
//   • tones    — the legend axis (a node's resolved StatusTone). Because lifecycleTone already projects
//                lifecycle × health onto a tone, this subsumes a separate lifecycle/health facet.
//   • verdicts — the orthogonal proof/test/blocking axis (a `live`-tone intent can still be `untested`).
//   • areas    — structural: feature.areaId ∈ areas.
//   • text     — case-insensitive substring over a node's label + summary/note/workflow labels.
export type StatusMapFilterState = {
	tones?: StatusTone[]
	verdicts?: VerdictCategory[]
	areas?: string[]
	text?: string
	/**
	 * @deprecated Legacy `ReviewFilter` key for the tone axis — kept so pre-D-006 callers (and the Vue
	 * `StatusMapExplorer`) that pass `{ statuses }` keep working byte-for-byte (PRD G4). New code uses `tones`.
	 * When both are present, `tones` wins; otherwise `statuses` is read as `tones`.
	 */
	statuses?: StatusTone[]
}

// Read the tone dimension tolerating the deprecated `statuses` alias (G4 back-compat). `tones` wins if set.
function resolveTones(state: StatusMapFilterState): StatusTone[] {
	return state.tones ?? state.statuses ?? []
}

// The four dimension keys, in a stable order — the single source of truth the store + URL codec reuse.
export const FILTER_DIMENSIONS = ['tones', 'verdicts', 'areas', 'text'] as const
export type FilterDimension = (typeof FILTER_DIMENSIONS)[number]

// Active iff at least one dimension is non-empty (a blank `text` does not count).
export function isFilterActive(state: StatusMapFilterState): boolean {
	return !!(
		resolveTones(state).length ||
		state.verdicts?.length ||
		state.areas?.length ||
		state.text?.trim()
	)
}

// ── The predicate ───────────────────────────────────────────────────────────────────────────────────
// Lowercase haystack of every text-searchable string on an intent (label + note + its workflows' labels/notes).
function intentText(i: UserIntent): string {
	const parts: string[] = [i.label]
	if (i.note) parts.push(i.note)
	for (const w of i.workflows || []) {
		parts.push(w.label)
		if (w.note) parts.push(w.note)
	}
	return parts.join(' ').toLowerCase()
}

// Lowercase haystack for a feature: its own label + summary, plus everything from its intents (so a feature
// stays visible when the query matches deep — the renderer prunes to matching intents separately below).
function featureText(f: LedgerFeature): string {
	const parts: string[] = [f.label]
	if (f.summary) parts.push(f.summary)
	for (const i of f.intents || []) parts.push(intentText(i))
	return parts.join(' ').toLowerCase()
}

// Prune the ledger to the items the filter keeps, preserving the area → feature → intent topology so EVERY
// view and EVERY section kind reflects the filter (not just `cards`). The dimensions AND-combine at the leaf.
//
// Leaf rule: an intent is kept iff it satisfies every active dimension. A feature with intents is kept iff at
// least one intent survives (and it carries only the surviving intents). A feature with NO intents is a leaf
// matched by its own tone + text; the verdict axis is intent-level, so a verdict filter excludes an
// intent-less feature. An area is kept iff at least one of its features survives.
export function filterLedger(ledger: Ledger, state: StatusMapFilterState): Ledger {
	if (!isFilterActive(state)) {
		return ledger
	}
	const tones = resolveTones(state)
	const verdicts = state.verdicts ?? []
	const areas = state.areas ?? []
	const query = (state.text ?? '').trim().toLowerCase()

	const toneMatch = (tone: StatusTone) => !tones.length || tones.includes(tone)
	const verdictMatch = (cats: VerdictCategory[]) =>
		!verdicts.length || cats.some((c) => verdicts.includes(c))
	const areaMatch = (areaId: string) => !areas.length || areas.includes(areaId)

	const intentVisible = (i: UserIntent) =>
		toneMatch(lifecycleTone(i.lifecycle, i.health)) &&
		verdictMatch(intentVerdictCategories(i)) &&
		(!query || intentText(i).includes(query))

	const keepFeature = (f: LedgerFeature): LedgerFeature | null => {
		if (!areaMatch(f.areaId)) {
			return null
		}
		if (f.intents?.length) {
			// Text matches against the WHOLE feature (label/summary/any intent); if it matches the feature
			// shell but no single intent, keep the feature with all its intents — otherwise prune to the
			// intents that survive every dimension.
			const matchedIntents = f.intents.filter(intentVisible)
			if (matchedIntents.length) {
				return { ...f, intents: matchedIntents }
			}
			// No intent survives. The feature can still qualify on text alone (e.g. the query hit the summary)
			// — but only when no leaf-level dimension (tone/verdict) is narrowing, since those are decided at
			// the intent and produced no match.
			if (query && !tones.length && !verdicts.length && featureText(f).includes(query)) {
				return f
			}
			return null
		}
		// A feature with no intents is a leaf matched by its own tone + text; a verdict filter (intent-level)
		// excludes it.
		const leafOk =
			toneMatch(featureTone(f)) && !verdicts.length && (!query || featureText(f).includes(query))
		return leafOk ? f : null
	}

	const features = ledger.features
		.map(keepFeature)
		.filter((f): f is LedgerFeature => f !== null)
	const areaIds = new Set(features.map((f) => f.areaId))
	const keptAreas = ledger.areas.filter((a) => areaIds.has(a.id))
	return { ...ledger, areas: keptAreas, features }
}

// A compact summary for a "showing N of M" filter banner.
export function filterSummary(
	ledger: Ledger,
	state: StatusMapFilterState,
): { shown: number; total: number } {
	return {
		shown: filterLedger(ledger, state).features.length,
		total: ledger.features.length,
	}
}
