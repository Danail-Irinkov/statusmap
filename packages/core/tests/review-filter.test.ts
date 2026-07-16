import { describe, it, expect } from 'vitest'
import {
	filterLedger,
	intentVerdictCategories,
	isReviewFilterActive,
	NEEDS_ATTENTION_TONES,
	reviewFilterSummary,
	type Ledger,
	type UserIntent,
} from '../src/index'

const intent = (over: Partial<UserIntent>): UserIntent => ({
	id: 'i',
	label: 'i',
	lifecycle: 'live',
	...over,
})

describe('intentVerdictCategories', () => {
	it('classifies the tested axis', () => {
		expect(intentVerdictCategories(intent({ coverage: { proofLevel: 'none' } }))).toContain('untested')
		expect(intentVerdictCategories(intent({ coverage: { proofLevel: 'heuristic', passing: true } }))).toContain('heuristic')
		expect(intentVerdictCategories(intent({ lifecycle: 'partial', coverage: { proofLevel: 'owning_e2e', passing: false } }))).toContain('failing')
		expect(intentVerdictCategories(intent({ coverage: { proofLevel: 'destination', passing: true } }))).toContain('proven')
	})

	it('adds blocking categories (an intent can be several at once)', () => {
		const cats = intentVerdictCategories(
			intent({ lifecycle: 'partial', health: 'down', coverage: { proofLevel: 'owning_e2e', passing: false } }),
		)
		expect(cats).toContain('failing')
		expect(cats).toContain('blocked')
		expect(intentVerdictCategories(intent({ lifecycle: 'not_built' }))).toContain('not_built')
	})
})

const ledger = (): Ledger => ({
	areas: [
		{ id: 'a1', label: 'A1' },
		{ id: 'a2', label: 'A2' },
	],
	features: [
		{
			id: 'live-feat',
			label: 'Live feature',
			areaId: 'a1',
			lifecycle: 'live',
			intents: [{ id: 'ok', label: 'OK', lifecycle: 'live', coverage: { proofLevel: 'destination', passing: true } }],
		},
		{
			id: 'mixed-feat',
			label: 'Mixed feature',
			areaId: 'a1',
			lifecycle: 'partial',
			intents: [
				{ id: 'ok2', label: 'OK2', lifecycle: 'live', coverage: { proofLevel: 'owning_e2e', passing: true } },
				{ id: 'bad', label: 'Bad', lifecycle: 'partial', health: 'down', coverage: { proofLevel: 'owning_e2e', passing: false } },
			],
		},
		{ id: 'parked', label: 'Parked', areaId: 'a2', lifecycle: 'deferred' }, // no intents (leaf)
	],
})

describe('filterLedger', () => {
	it('is a no-op when no filter is active', () => {
		expect(isReviewFilterActive({})).toBe(false)
		expect(filterLedger(ledger(), {}).features).toHaveLength(3)
	})

	it('status: "Needs attention" drops the fully-live feature, keeps non-live work', () => {
		const out = filterLedger(ledger(), { statuses: NEEDS_ATTENTION_TONES })
		const ids = out.features.map((f) => f.id)
		expect(ids).not.toContain('live-feat') // live + its only intent is live → gone
		expect(ids).toContain('mixed-feat') // has the non-live "bad" intent
		expect(ids).toContain('parked') // deferred leaf (tone stale ∈ needs-attention)
		// the mixed feature keeps ONLY its non-live intent
		expect(out.features.find((f) => f.id === 'mixed-feat')!.intents).toHaveLength(1)
	})

	it('verdict: "failing" keeps only features containing a failing intent; intent-less leaf dropped', () => {
		const out = filterLedger(ledger(), { verdicts: ['failing'] })
		expect(out.features.map((f) => f.id)).toEqual(['mixed-feat'])
		expect(out.features[0].intents).toHaveLength(1)
		expect(out.features[0].intents![0].id).toBe('bad')
	})

	it('AND-combines the two axes at the intent level', () => {
		// red status + failing verdict → the "bad" intent (red + failing) survives
		const out = filterLedger(ledger(), { statuses: ['red'], verdicts: ['failing'] })
		expect(out.features.map((f) => f.id)).toEqual(['mixed-feat'])
		expect(out.features[0].intents![0].id).toBe('bad')
		// red status + untested verdict → nothing (the red intent is failing, not untested)
		expect(filterLedger(ledger(), { statuses: ['red'], verdicts: ['untested'] }).features).toHaveLength(0)
	})

	it('prunes areas with no surviving features', () => {
		const out = filterLedger(ledger(), { verdicts: ['failing'] })
		expect(out.areas.map((a) => a.id)).toEqual(['a1']) // a2 (only the parked leaf) is gone
	})

	it('reviewFilterSummary reports shown vs total', () => {
		expect(reviewFilterSummary(ledger(), { verdicts: ['failing'] })).toEqual({ shown: 1, total: 3 })
	})
})
