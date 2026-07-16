import { describe, it, expect } from 'vitest'
import {
	filterLedger,
	filterSummary,
	intentVerdictCategories,
	isFilterActive,
	NEEDS_ATTENTION_TONES,
	// back-compat surface (re-exported under original names from review-filter.ts via the barrel)
	isReviewFilterActive,
	reviewFilterSummary,
	type Ledger,
	type ReviewFilter,
	type UserIntent,
} from '../src/index'

const intent = (over: Partial<UserIntent>): UserIntent => ({
	id: 'i',
	label: 'i',
	lifecycle: 'live',
	...over,
})

// A fixture spanning the four dimensions: two areas; live / mixed / parked features; intents with distinct
// tones + verdicts + searchable labels and summaries.
const ledger = (): Ledger => ({
	areas: [
		{ id: 'a1', label: 'Search' },
		{ id: 'a2', label: 'Parking' },
	],
	features: [
		{
			id: 'live-feat',
			label: 'Live feature',
			areaId: 'a1',
			lifecycle: 'live',
			summary: 'Everything green here',
			intents: [
				{
					id: 'ok',
					label: 'Search my notes',
					lifecycle: 'live',
					coverage: { proofLevel: 'destination', passing: true },
				},
			],
		},
		{
			id: 'mixed-feat',
			label: 'Mixed feature',
			areaId: 'a1',
			lifecycle: 'partial',
			summary: 'Half works',
			intents: [
				{
					id: 'ok2',
					label: 'Export results',
					lifecycle: 'live',
					coverage: { proofLevel: 'owning_e2e', passing: true },
				},
				{
					id: 'bad',
					label: 'Bulk delete',
					lifecycle: 'partial',
					health: 'down',
					note: 'flaky on large sets',
					coverage: { proofLevel: 'owning_e2e', passing: false },
				},
			],
		},
		{ id: 'parked', label: 'Parked roadmap', areaId: 'a2', lifecycle: 'deferred', summary: 'later' }, // intent-less leaf
	],
})

describe('isFilterActive', () => {
	it('an empty state is inactive (full map)', () => {
		expect(isFilterActive({})).toBe(false)
		expect(isFilterActive({ tones: [], verdicts: [], areas: [], text: '' })).toBe(false)
		expect(isFilterActive({ text: '   ' })).toBe(false) // whitespace-only text does not activate
	})
	it('any non-empty dimension activates', () => {
		expect(isFilterActive({ tones: ['red'] })).toBe(true)
		expect(isFilterActive({ verdicts: ['failing'] })).toBe(true)
		expect(isFilterActive({ areas: ['a1'] })).toBe(true)
		expect(isFilterActive({ text: 'notes' })).toBe(true)
	})
})

describe('filterLedger — empty state returns the full ledger', () => {
	it('is a no-op when no dimension is set', () => {
		const led = ledger()
		const out = filterLedger(led, {})
		expect(out.features).toHaveLength(3)
		expect(out.areas).toHaveLength(2)
		expect(out).toBe(led) // identity: the same object is returned, not a copy
	})
})

describe('filterLedger — tones dimension narrows correctly', () => {
	it('"Needs attention" includes beta-test-ready work', () => {
		expect(NEEDS_ATTENTION_TONES).toContain('beta')
	})

	it('"Needs attention" drops the fully-live feature, keeps non-live work', () => {
		const out = filterLedger(ledger(), { tones: NEEDS_ATTENTION_TONES })
		const ids = out.features.map((f) => f.id)
		expect(ids).not.toContain('live-feat') // live + its only intent is live → gone
		expect(ids).toContain('mixed-feat') // has the non-live "bad" intent
		expect(ids).toContain('parked') // deferred leaf (tone stale ∈ needs-attention)
		// the mixed feature keeps ONLY its non-live intent (OR-within tone matched just the red one)
		expect(out.features.find((f) => f.id === 'mixed-feat')!.intents).toHaveLength(1)
		expect(out.features.find((f) => f.id === 'mixed-feat')!.intents![0].id).toBe('bad')
	})
})

describe('filterLedger — verdicts dimension narrows correctly', () => {
	it('"failing" keeps only features containing a failing intent; intent-less leaf dropped', () => {
		const out = filterLedger(ledger(), { verdicts: ['failing'] })
		expect(out.features.map((f) => f.id)).toEqual(['mixed-feat'])
		expect(out.features[0].intents).toHaveLength(1)
		expect(out.features[0].intents![0].id).toBe('bad')
	})
	it('matches the verdicts intentVerdictCategories assigns', () => {
		expect(intentVerdictCategories(intent({ coverage: { proofLevel: 'none' } }))).toContain('untested')
		const out = filterLedger(ledger(), { verdicts: ['proven'] })
		// both proven intents qualify: "ok" (destination) in live-feat, "ok2" (owning_e2e) in mixed-feat
		expect(out.features.map((f) => f.id)).toEqual(['live-feat', 'mixed-feat'])
		// mixed-feat keeps ONLY its proven intent (the failing "bad" is pruned) — OR-within at the leaf
		expect(out.features.find((f) => f.id === 'mixed-feat')!.intents!.map((i) => i.id)).toEqual(['ok2'])
	})
})

describe('filterLedger — areas dimension narrows correctly', () => {
	it('keeps only features in the selected area(s)', () => {
		const out = filterLedger(ledger(), { areas: ['a2'] })
		expect(out.features.map((f) => f.id)).toEqual(['parked'])
		expect(out.areas.map((a) => a.id)).toEqual(['a2'])
	})
	it('OR-within areas keeps features from any listed area', () => {
		const out = filterLedger(ledger(), { areas: ['a1', 'a2'] })
		expect(out.features).toHaveLength(3)
	})
})

describe('filterLedger — text dimension matches labels + summaries', () => {
	it('matches an intent label (case-insensitive), pruning to the matching intent', () => {
		const out = filterLedger(ledger(), { text: 'BULK' })
		expect(out.features.map((f) => f.id)).toEqual(['mixed-feat'])
		expect(out.features[0].intents).toHaveLength(1)
		expect(out.features[0].intents![0].id).toBe('bad')
	})
	it('matches a feature summary even when no single intent matches (keeps all intents)', () => {
		const out = filterLedger(ledger(), { text: 'half works' })
		expect(out.features.map((f) => f.id)).toEqual(['mixed-feat'])
		expect(out.features[0].intents).toHaveLength(2) // matched the shell → keep both intents
	})
	it('matches a workflow note via the intent haystack', () => {
		const out = filterLedger(ledger(), { text: 'flaky' })
		expect(out.features.map((f) => f.id)).toEqual(['mixed-feat'])
		expect(out.features[0].intents![0].id).toBe('bad')
	})
	it('matches an intent-less leaf by its own label/summary', () => {
		expect(filterLedger(ledger(), { text: 'roadmap' }).features.map((f) => f.id)).toEqual(['parked'])
	})
	it('no match → empty map', () => {
		expect(filterLedger(ledger(), { text: 'nonexistent zzz' }).features).toHaveLength(0)
	})
})

describe('filterLedger — AND-across dimensions, OR-within', () => {
	it('tones AND verdicts intersect at the intent level', () => {
		// red tone + failing verdict → the "bad" intent (red + failing) survives
		const out = filterLedger(ledger(), { tones: ['red'], verdicts: ['failing'] })
		expect(out.features.map((f) => f.id)).toEqual(['mixed-feat'])
		expect(out.features[0].intents![0].id).toBe('bad')
		// red tone + untested verdict → nothing (the red intent is failing, not untested)
		expect(filterLedger(ledger(), { tones: ['red'], verdicts: ['untested'] }).features).toHaveLength(0)
	})
	it('text AND area intersect', () => {
		// "search my notes" lives in area a1; require a2 → no match
		expect(filterLedger(ledger(), { text: 'notes', areas: ['a2'] }).features).toHaveLength(0)
		expect(filterLedger(ledger(), { text: 'notes', areas: ['a1'] }).features.map((f) => f.id)).toEqual([
			'live-feat',
		])
	})
	it('area AND verdict intersect (area gates before the leaf verdict)', () => {
		// failing verdict exists only in a1; restrict to a2 → empty
		expect(filterLedger(ledger(), { areas: ['a2'], verdicts: ['failing'] }).features).toHaveLength(0)
	})
})

describe('filterLedger — area pruning', () => {
	it('prunes areas with no surviving features', () => {
		const out = filterLedger(ledger(), { verdicts: ['failing'] })
		expect(out.areas.map((a) => a.id)).toEqual(['a1']) // a2 (only the parked leaf) is gone
	})
})

describe('filterSummary', () => {
	it('reports shown vs total features', () => {
		expect(filterSummary(ledger(), { verdicts: ['failing'] })).toEqual({ shown: 1, total: 3 })
		expect(filterSummary(ledger(), {})).toEqual({ shown: 3, total: 3 })
	})
})

describe('back-compat (G4) — ReviewFilter / statuses alias + legacy fn names', () => {
	it('the deprecated `statuses` key is honored as the tone axis', () => {
		const legacy: ReviewFilter = { statuses: NEEDS_ATTENTION_TONES }
		const out = filterLedger(ledger(), legacy)
		// identical behavior to { tones: NEEDS_ATTENTION_TONES }
		const ids = out.features.map((f) => f.id)
		expect(ids).not.toContain('live-feat')
		expect(ids).toContain('mixed-feat')
		expect(isReviewFilterActive(legacy)).toBe(true)
		expect(isReviewFilterActive({})).toBe(false)
	})
	it('`tones` wins when both `tones` and `statuses` are present', () => {
		const out = filterLedger(ledger(), { tones: ['red'], statuses: ['live'] })
		// resolves to tones:['red'] → only the failing red intent
		expect(out.features.map((f) => f.id)).toEqual(['mixed-feat'])
		expect(out.features[0].intents![0].id).toBe('bad')
	})
	it('reviewFilterSummary aliases filterSummary', () => {
		expect(reviewFilterSummary(ledger(), { verdicts: ['failing'] })).toEqual({ shown: 1, total: 3 })
	})
})
