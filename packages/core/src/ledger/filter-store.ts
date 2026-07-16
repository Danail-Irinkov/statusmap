// The framework-neutral filter STATE STORE (PRD §6.6 / D-006). Pure, immutable transitions + selectors + a
// URL codec, with ZERO framework imports — the renderers bind these to Vue `ref` / React `useState` in ~15
// lines each, which is how the parity guarantee (G1) is made structural rather than hoped-for.
//
// All transitions return a NEW StatusMapFilterState (never mutate the input), so they drop straight into any
// reactive system. Group keys ('tones' | 'verdicts' | 'areas') carry array dimensions; `text` is the single
// free-text dimension. Empty arrays / blank text are normalized away so `isFilterActive` and the URL codec
// agree on what "inactive" means.

import type { StatusTone } from '../types'
import type { StatusMapFilterState, VerdictCategory } from './filter'

// The three array-valued dimensions a value can be toggled within (the legend tones, the verdict chips, the
// area facet). `text` is handled by setText, not toggleValue.
export type FilterGroup = 'tones' | 'verdicts' | 'areas'

// A value that can live in one of the array dimensions. Typed loosely (string) because each group's element
// type differs (StatusTone vs VerdictCategory vs areaId); callers pass the right value for the group.
export type FilterValue = StatusTone | VerdictCategory | string

// ── Transitions (pure, immutable) ─────────────────────────────────────────────────────────────────────
const dedupe = <T>(xs: T[]): T[] => [...new Set(xs)]

// Add `value` to a group if absent, remove it if present. Returns a new state. An emptied group is dropped
// to keep the state canonical (so a round-trip through the URL codec is stable).
export function toggleValue(
	state: StatusMapFilterState,
	group: FilterGroup,
	value: FilterValue,
): StatusMapFilterState {
	const current = (state[group] as FilterValue[] | undefined) ?? []
	const has = current.includes(value)
	const next = has ? current.filter((v) => v !== value) : [...current, value]
	return withGroup(state, group, next)
}

// Toggle a whole SET of values together (the "Built / partial" preset chip covers ['yellow'], "Needs
// attention" covers NEEDS_ATTENTION_TONES, …). If every value is already present, remove them all; otherwise
// add the missing ones. Returns a new state.
export function toggleGroup(
	state: StatusMapFilterState,
	group: FilterGroup,
	values: FilterValue[],
): StatusMapFilterState {
	const current = (state[group] as FilterValue[] | undefined) ?? []
	const allOn = values.length > 0 && values.every((v) => current.includes(v))
	const next = allOn
		? current.filter((v) => !values.includes(v))
		: dedupe([...current, ...values])
	return withGroup(state, group, next)
}

// Set (or clear) the free-text dimension. Blank/whitespace clears it. Returns a new state.
export function setText(state: StatusMapFilterState, text: string): StatusMapFilterState {
	const next = { ...state }
	if (text.trim()) {
		next.text = text
	} else {
		delete next.text
	}
	return next
}

// Reset to the inactive state (the full map).
export function clearFilter(): StatusMapFilterState {
	return {}
}

// Internal: write a group's array onto a fresh state, dropping it entirely when empty (canonical form).
function withGroup(
	state: StatusMapFilterState,
	group: FilterGroup,
	values: FilterValue[],
): StatusMapFilterState {
	const next = { ...state }
	if (values.length) {
		;(next[group] as FilterValue[]) = dedupe(values)
	} else {
		delete next[group]
	}
	return next
}

// ── Selectors ──────────────────────────────────────────────────────────────────────────────────────────
export function isValueActive(
	state: StatusMapFilterState,
	group: FilterGroup,
	value: FilterValue,
): boolean {
	return ((state[group] as FilterValue[] | undefined) ?? []).includes(value)
}

// How many discrete things are filtering: each selected tone/verdict/area counts once, plus 1 if text is set.
// Reads the deprecated `statuses` alias too, so a legacy-keyed state still counts its tone axis.
export function activeCount(state: StatusMapFilterState): number {
	return (
		(state.tones?.length ?? state.statuses?.length ?? 0) +
		(state.verdicts?.length ?? 0) +
		(state.areas?.length ?? 0) +
		(state.text?.trim() ? 1 : 0)
	)
}

// Note: the canonical "is anything filtering" predicate is `isFilterActive` (exported from ./filter); it is
// imported above for internal use and re-exported from the package barrel via ./filter, not re-exported here
// (that would be a duplicate export). `isFilterActive` is referenced internally to keep one definition.

// ── URL codec ────────────────────────────────────────────────────────────────────────────────────────
// Keys: tones= / verdicts= / areas= (comma-joined), q= (free text). Only non-empty dimensions are written,
// so a clear filter yields no params and `filterToQuery ∘ filterFromQuery` round-trips to the same canonical
// state. The renderers merge these into the explorer's existing view/area/feature query.
const QUERY_KEYS: Record<FilterGroup, string> = { tones: 'tones', verdicts: 'verdicts', areas: 'areas' }
const TEXT_KEY = 'q'

export function filterToQuery(state: StatusMapFilterState): URLSearchParams {
	const params = new URLSearchParams()
	for (const group of ['tones', 'verdicts', 'areas'] as FilterGroup[]) {
		const values = (state[group] as FilterValue[] | undefined) ?? []
		if (values.length) {
			params.set(QUERY_KEYS[group], values.join(','))
		}
	}
	if (state.text?.trim()) {
		params.set(TEXT_KEY, state.text.trim())
	}
	return params
}

// Parse the dimensions out of a query. Accepts a URLSearchParams, a query string, or a plain record. Unknown
// keys are ignored (so it co-exists with view=/area=/feature=). Empty values produce an inactive state.
export function filterFromQuery(
	input: URLSearchParams | string | Record<string, string | string[] | undefined>,
): StatusMapFilterState {
	const get = (key: string): string | undefined => {
		if (input instanceof URLSearchParams) return input.get(key) ?? undefined
		if (typeof input === 'string') return new URLSearchParams(input).get(key) ?? undefined
		const v = input[key]
		return Array.isArray(v) ? v[0] : v
	}
	const splitList = (raw: string | undefined): string[] =>
		(raw ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)

	const state: StatusMapFilterState = {}
	const tones = splitList(get(QUERY_KEYS.tones)) as StatusTone[]
	const verdicts = splitList(get(QUERY_KEYS.verdicts)) as VerdictCategory[]
	const areas = splitList(get(QUERY_KEYS.areas))
	const text = get(TEXT_KEY)?.trim()
	if (tones.length) state.tones = dedupe(tones)
	if (verdicts.length) state.verdicts = dedupe(verdicts)
	if (areas.length) state.areas = dedupe(areas)
	if (text) state.text = text
	return state
}
