import { describe, expect, it } from 'vitest'
import {
	activeCount,
	applyCoverageTests,
	buildTestResults,
	collectLedgerTags,
	createStatusMap,
	featureTags,
	filterFromQuery,
	filterLedger,
	filterToQuery,
	intentTags,
	isFilterActive,
	normalizeTag,
	parsePlaywrightJson,
	toggleValue,
	validateLedger,
	type Ledger,
} from '../src/index'

// Two intents in one feature: `fast` is owned by a spec tagged (via its suite) 'sanity'; `slow` by a spec
// tagged 'regression'. A workflow under `fast` carries an authored tag.
const ledger = (): Ledger => ({
	areas: [
		{ id: 'crm', label: 'CRM' },
		{ id: 'ops', label: 'Ops', tags: ['ops-only'] },
	],
	features: [
		{
			id: 'companies',
			label: 'Companies',
			areaId: 'crm',
			lifecycle: 'live',
			intents: [
				{
					id: 'fast',
					label: 'Browse the list',
					lifecycle: 'live',
					coverage: { proofLevel: 'owning_e2e', passing: true, owningE2e: 'company-list.cy.js' },
					workflows: [{ id: 'w', label: 'Sort', lifecycle: 'live', tags: ['@smoke'] }],
				},
				{
					id: 'slow',
					label: 'Batch edit',
					lifecycle: 'live',
					coverage: { proofLevel: 'owning_e2e', passing: false, owningE2e: 'company-batch.cy.js' },
				},
			],
		},
		{
			id: 'orders',
			label: 'Orders',
			areaId: 'crm',
			lifecycle: 'live',
			intents: [{ id: 'o', label: 'Create an order', lifecycle: 'live' }],
		},
		{
			id: 'parts',
			label: 'Parts',
			areaId: 'ops',
			lifecycle: 'live',
			intents: [{ id: 'p', label: 'Count parts', lifecycle: 'live' }],
		},
	],
})

const report = {
	suites: [
		{
			title: '',
			file: 'cypress/e2e/Company/company-list.cy.js',
			tags: ['@sanity'],
			specs: [
				{
					title: 'sorts',
					ok: true,
					tags: ['fast'],
					tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
				},
			],
		},
		{
			title: '',
			file: 'cypress/e2e/Company/company-batch.cy.js',
			suites: [
				{
					title: 'batch',
					tags: ['regression'],
					specs: [
						{
							title: 'edits',
							ok: false,
							tests: [{ status: 'unexpected', results: [{ status: 'failed' }] }],
						},
					],
				},
			],
		},
	],
}

const overlaid = () => applyCoverageTests(ledger(), buildTestResults({ playwrightJson: report }))
const featureIds = (l: Ledger) => l.features.map((f) => f.id)
const intentIds = (l: Ledger, feature = 0) => l.features[feature].intents!.map((i) => i.id)

describe('tag collection', () => {
	it('normalizes a leading @ so Playwright tags and authored tags are the same tag', () => {
		expect(normalizeTag(' @sanity ')).toBe('sanity')
		expect(normalizeTag(42)).toBe('')
	})

	it('reads suite tags (inherited by nested suites) and spec tags off a Playwright report', () => {
		const tags = parsePlaywrightJson(report).map((r) => [r.name, r.tags])
		expect(tags).toEqual([
			['sorts', ['sanity', 'fast']],
			['edits', ['regression']],
		])
	})

	it('leaves untagged results without a tags key', () => {
		const [r] = parsePlaywrightJson({ suites: [{ file: 'a.spec.ts', specs: [{ title: 't', ok: true }] }] })
		expect('tags' in r).toBe(false)
	})

	it('merges matched suite/spec tags into the intent that owns the spec, then unions up the tree', () => {
		const l = overlaid()
		const fast = l.features[0].intents![0]
		expect(fast.tags).toEqual(['sanity', 'fast'])
		expect(intentTags(fast)).toEqual(['sanity', 'fast', 'smoke']) // + its workflow's authored tag
		expect(featureTags(l.features[0])).toEqual(['sanity', 'fast', 'smoke', 'regression'])
		expect(collectLedgerTags(l)).toEqual(['fast', 'ops-only', 'regression', 'sanity', 'smoke'])
	})

	it('does not mutate the input ledger and adds no tags key to unmatched nodes', () => {
		const base = ledger()
		const l = applyCoverageTests(base, buildTestResults({ playwrightJson: report }))
		expect(base.features[0].intents![0].tags).toBeUndefined()
		expect('tags' in l.features[1].intents![0]).toBe(false)
	})

	it('unions the tags of a de-duplicated repeated result', () => {
		const spec = (tag: string) => ({ file: 'x.spec.ts', specs: [{ title: 't', ok: true, tags: [tag] }] })
		const both = buildTestResults({ playwrightJson: { suites: [spec('a'), spec('b')] } })
		expect(both).toHaveLength(1)
		expect(both[0].tags).toEqual(['a', 'b'])
	})

	it('carries tags authored at every level through createStatusMap', () => {
		const files = {
			'areas.yaml': JSON.stringify([{ id: 'a', label: 'A', tags: ['area-tag'] }]),
			'f.yaml': JSON.stringify({
				id: 'f',
				label: 'F',
				areaId: 'a',
				lifecycle: 'live',
				tags: ['feat-tag'],
				intents: [
					{
						id: 'i',
						label: 'I',
						lifecycle: 'live',
						tags: ['intent-tag'],
						workflows: [{ id: 'w', label: 'W', lifecycle: 'live', tags: ['wf-tag'] }],
					},
				],
			}),
		}
		const { ledger: l } = createStatusMap(files, JSON.parse)
		expect(collectLedgerTags(l)).toEqual(['area-tag', 'feat-tag', 'intent-tag', 'wf-tag'])
	})

	it('validates that tags are a list of non-empty strings', () => {
		const bad = ledger()
		;(bad.features[0] as unknown as { tags: unknown }).tags = 'sanity'
		bad.features[1].intents![0].tags = ['ok', ' ']
		const errs = validateLedger(bad)
		expect(errs.filter((e) => e.includes('tags must be'))).toHaveLength(2)
		expect(validateLedger(overlaid())).toEqual([])
	})
})

describe('filterLedger — tags dimension', () => {
	it('is inactive when empty and active when a tag is selected', () => {
		expect(isFilterActive({ tags: [] })).toBe(false)
		expect(isFilterActive({ tags: ['sanity'] })).toBe(true)
	})

	it('keeps only intents that carry the tag, plus their ancestors', () => {
		const out = filterLedger(overlaid(), { tags: ['sanity'] })
		expect(featureIds(out)).toEqual(['companies'])
		expect(intentIds(out)).toEqual(['fast'])
		expect(out.areas.map((a) => a.id)).toEqual(['crm']) // ancestor stays, empty areas go
	})

	it('matches a tag that only a workflow carries, via the intent above it', () => {
		expect(intentIds(filterLedger(overlaid(), { tags: ['smoke'] }))).toEqual(['fast'])
	})

	it('is OR within the dimension', () => {
		expect(intentIds(filterLedger(overlaid(), { tags: ['sanity', 'regression'] }))).toEqual(['fast', 'slow'])
	})

	it('treats @sanity and sanity as the same selection', () => {
		expect(featureIds(filterLedger(overlaid(), { tags: ['@sanity'] }))).toEqual(['companies'])
	})

	it('composes (AND) with the tone filter: sanity + green vs regression + green', () => {
		// Make the regression-tagged intent a different tone so the tone dimension has something to exclude.
		const l = overlaid()
		l.features[0].intents![1] = { ...l.features[0].intents![1], lifecycle: 'partial' }
		const live = filterLedger(l, { tags: ['sanity', 'regression'], tones: ['live'] })
		expect(intentIds(live)).toEqual(['fast'])
		expect(filterLedger(l, { tags: ['regression'], tones: ['live'] }).features).toEqual([])
	})

	it('composes with text search', () => {
		const both = filterLedger(overlaid(), { tags: ['sanity', 'regression'], text: 'batch' })
		expect(intentIds(both)).toEqual(['slow'])
		expect(filterLedger(overlaid(), { tags: ['sanity'], text: 'batch' }).features).toEqual([])
	})

	it('lets a tag authored on an area or feature match everything beneath it', () => {
		expect(featureIds(filterLedger(overlaid(), { tags: ['ops-only'] }))).toEqual(['parts'])
		const l = ledger()
		l.features[1].tags = ['orders-tier']
		expect(featureIds(filterLedger(l, { tags: ['orders-tier'] }))).toEqual(['orders'])
	})

	it('filters an intent-less feature by its own tags', () => {
		const l = ledger()
		l.features.push({ id: 'bare', label: 'Bare', areaId: 'crm', lifecycle: 'live', tags: ['sanity'] })
		expect(featureIds(filterLedger(l, { tags: ['sanity'] }))).toEqual(['bare'])
	})

	it('picks up tags injected programmatically on plain ledger objects', () => {
		const l = ledger()
		l.features[2].intents![0].tags = ['injected']
		expect(collectLedgerTags(l)).toContain('injected')
		expect(featureIds(filterLedger(l, { tags: ['injected'] }))).toEqual(['parts'])
	})
})

describe('tag filter state + URL', () => {
	it('toggles tags like any other group and counts them', () => {
		const on = toggleValue({}, 'tags', 'sanity')
		expect(on).toEqual({ tags: ['sanity'] })
		expect(activeCount(on)).toBe(1)
		expect(toggleValue(on, 'tags', 'sanity')).toEqual({})
	})

	it('round-trips through ?tag=', () => {
		const state = { tags: ['sanity', 'smoke'], tones: ['live' as const] }
		const params = filterToQuery(state)
		expect(params.get('tag')).toBe('sanity,smoke')
		expect(filterFromQuery(params)).toEqual(state)
		expect(filterFromQuery('?tag=sanity')).toEqual({ tags: ['sanity'] })
	})
})
