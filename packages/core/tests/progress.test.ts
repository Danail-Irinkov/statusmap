import { describe, expect, it } from 'vitest'
import {
	featureScopeProgress,
	rollupScopeProgress,
	type LedgerFeature,
} from '../src/index'

const feature = (overrides: Partial<LedgerFeature>): LedgerFeature => ({
	id: 'feature',
	label: 'Feature',
	areaId: 'core',
	lifecycle: 'planned',
	...overrides,
})

describe('featureScopeProgress', () => {
	it('honors the explicit stage anchors', () => {
		expect(featureScopeProgress(feature({ progress: { stage: 'planned' } })).percent).toBe(0)
		expect(featureScopeProgress(feature({ progress: { stage: 'prd_ready' } })).percent).toBe(20)
		expect(featureScopeProgress(feature({ progress: { stage: 'foundation' } })).percent).toBe(40)
		expect(featureScopeProgress(feature({ progress: { stage: 'beta_ready' } })).percent).toBe(85)
		expect(featureScopeProgress(feature({ progress: { stage: 'complete' } })).percent).toBe(100)
	})

	it('scores active build scope between foundation and test-readiness', () => {
		const summary = featureScopeProgress(
			feature({
				progress: {
					stage: 'building',
					currentScope: [
						{ id: 'done-a', label: 'Done A', status: 'done' },
						{ id: 'done-b', label: 'Done B', status: 'done' },
						{ id: 'partial', label: 'Partial', status: 'partial' },
						{ id: 'planned', label: 'Planned', status: 'planned' },
						{ id: 'blocked', label: 'Blocked', status: 'blocked' },
						{ id: 'deferred', label: 'Deferred', status: 'deferred' },
					],
				},
			}),
		)

		expect(summary.percent).toBe(58)
		expect(summary.counts.current).toEqual({ total: 5, done: 2, partial: 1, planned: 1, blocked: 1 })
		expect(summary.counts.excluded).toEqual({ deferred: 1, out_of_scope: 0 })
	})

	it('scores test coverage between built and beta-ready', () => {
		const summary = featureScopeProgress(
			feature({
				lifecycle: 'built',
				progress: { stage: 'tested' },
				intents: [
					{
						id: 'destination',
						label: 'Destination proof',
						lifecycle: 'built',
						coverage: { proofLevel: 'destination', passing: true },
					},
					{
						id: 'unit',
						label: 'Unit proof',
						lifecycle: 'built',
						coverage: { proofLevel: 'unit', passing: true },
					},
				],
			}),
		)

		expect(summary.percent).toBe(83)
		expect(summary.stage).toBe('tested')
	})

	it('uses live human proof to move beta-ready work toward complete', () => {
		expect(
			featureScopeProgress(
				feature({
					progress: {
						stage: 'live_validation',
						liveProof: { successfulThreads: 1, successfulUsers: 0 },
					},
				}),
			).percent,
		).toBe(90)

		expect(
			featureScopeProgress(
				feature({
					progress: {
						stage: 'live_validation',
						liveProof: { successfulThreads: 3, successfulUsers: 0 },
					},
				}),
			).percent,
		).toBe(100)
	})

	it('infers conservative progress for unmigrated ledger items', () => {
		expect(featureScopeProgress(feature({ lifecycle: 'planned' })).percent).toBe(0)
		expect(featureScopeProgress(feature({ lifecycle: 'planned', prd: ['docs/FEATURE_PRD.md'] })).percent).toBe(20)
		expect(featureScopeProgress(feature({ lifecycle: 'built' })).percent).toBe(70)
		expect(featureScopeProgress(feature({ lifecycle: 'beta' })).percent).toBe(85)
		expect(featureScopeProgress(feature({ lifecycle: 'live' })).percent).toBe(85)
		expect(featureScopeProgress(feature({ lifecycle: 'beta' })).inferred).toBe(true)
	})
})

describe('rollupScopeProgress', () => {
	it('averages feature scope progress for parent summaries', () => {
		const summary = rollupScopeProgress([
			feature({ id: 'prd', progress: { stage: 'prd_ready' } }),
			feature({ id: 'beta', progress: { stage: 'beta_ready' } }),
		])

		expect(summary.percent).toBe(53)
		expect(summary.total).toBe(2)
		expect(summary.inferred).toBe(false)
	})
})
