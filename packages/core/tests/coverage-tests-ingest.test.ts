import { describe, it, expect } from 'vitest'
import {
	buildTestResults,
	buildTestTree,
	parsePlaywrightJson,
	parseVitestJson,
	resultsForIntent,
	testJoinKey,
	applyCoverageTests,
	type Ledger,
} from '../src/index'

const vitestJson = {
	testResults: [
		{
			name: '/repo/tests/editor-autosave.test.ts',
			assertionResults: [
				{ title: 'saves on blur', ancestorTitles: ['editor', 'autosave'], status: 'passed' },
				{ title: 'retries on failure', ancestorTitles: ['editor', 'autosave'], status: 'failed' },
			],
		},
	],
}

const playwrightJson = {
	suites: [
		{
			title: 'replay',
			file: 'offline-replay.spec.ts',
			specs: [
				{
					title: 'replays queued edits',
					line: 42,
					tests: [
						{
							results: [
								{
									status: 'failed',
									steps: [{ title: 'reconnect' }, { title: 'flush', error: {} }],
								},
							],
						},
					],
				},
			],
		},
	],
}

describe('parseVitestJson + buildTestTree', () => {
	it('parses assertions into results with suite paths', () => {
		const rs = parseVitestJson(vitestJson)
		expect(rs).toHaveLength(2)
		expect(rs[0].suitePath).toEqual(['editor', 'autosave'])
		expect(rs[0].file).toContain('editor-autosave')
	})

	it('rolls a suite up to failed when any leaf fails, tallying descendants', () => {
		const tree = buildTestTree(parseVitestJson(vitestJson))
		expect(tree[0].name).toBe('editor')
		expect(tree[0].status).toBe('failed')
		expect(tree[0].counts).toEqual({ passed: 1, failed: 1, skipped: 0 })
	})
})

describe('parsePlaywrightJson', () => {
	it('captures spec status + e2e steps, failing a step that has an error', () => {
		const rs = parsePlaywrightJson(playwrightJson)
		expect(rs).toHaveLength(1)
		expect(rs[0].line).toBe(42)
		expect(rs[0].status).toBe('failed')
		const tree = buildTestTree(rs)
		expect(tree[0].name).toBe('replay')
		expect(tree[0].status).toBe('failed')
		expect(tree[0].children?.[0].line).toBe(42)
		expect(JSON.stringify(tree)).toContain('flush') // the e2e step survives into the tree
	})
})

describe('resultsForIntent — the join key', () => {
	it('matches by file token and requires every group token in suite/name', () => {
		const rs = parseVitestJson(vitestJson)
		expect(resultsForIntent(rs, ['editor-autosave']).length).toBe(2)
		expect(resultsForIntent(rs, ['editor-autosave autosave']).length).toBe(2)
		expect(resultsForIntent(rs, ['editor-autosave nonexistent']).length).toBe(0)
		expect(resultsForIntent(rs, ['other-file']).length).toBe(0)
	})

	it('honors line-specific playwright targets through the same ref matcher', () => {
		const rs = parsePlaywrightJson({
			suites: [
				{
					file: 'account.spec.ts',
					specs: [
						{ title: 'first behavior', line: 10, tests: [{ results: [{ status: 'passed' }] }] },
						{ title: 'second behavior', line: 20, tests: [{ results: [{ status: 'failed' }] }] },
					],
				},
			],
		})
		expect(resultsForIntent(rs, ['account.spec.ts:20']).map((r) => r.name)).toEqual(['second behavior'])
		expect(resultsForIntent(rs, ['account.spec.ts:30'])).toHaveLength(0)
	})
})

describe('testJoinKey', () => {
	it('strips dirs + spec/test extensions and lowercases', () => {
		expect(testJoinKey('/a/b/Foo.spec.ts')).toBe('foo')
		expect(testJoinKey('Bar.test.tsx')).toBe('bar')
		expect(testJoinKey('baz.spec.ts:42')).toBe('baz')
	})
})

describe('buildTestResults', () => {
	it('merges vitest + playwright artifacts', () => {
		const merged = buildTestResults({ vitestJson, playwrightJson })
		expect(merged.length).toBe(3)
	})
})

describe('applyCoverageTests overlay', () => {
	it('overlays a run tree onto the intent whose owningE2e matches, leaving others untouched', () => {
		const ledger: Ledger = {
			areas: [{ id: 'a', label: 'A' }],
			features: [
				{
					id: 'f',
					label: 'F',
					areaId: 'a',
					lifecycle: 'live',
					intents: [
						{
							id: 'i',
							label: 'I',
							lifecycle: 'live',
							coverage: { owningE2e: 'editor-autosave', proofLevel: 'owning_e2e', passing: true },
						},
						{
							id: 'j',
							label: 'J',
							lifecycle: 'live',
							coverage: { owningE2e: 'unmatched', proofLevel: 'unit', passing: true },
						},
					],
				},
			],
		}
		const out = applyCoverageTests(ledger, parseVitestJson(vitestJson))
		expect(out.features[0].intents![0].coverage!.testTree?.length).toBeGreaterThan(0)
		expect(out.features[0].intents![1].coverage!.testTree).toBeUndefined()
	})
})
