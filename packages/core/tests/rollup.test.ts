import { describe, it, expect } from 'vitest'
import {
	featureHealth,
	healthValue,
	intentHealth,
	lifecycleHealth,
	lifecycleTone,
	rollupFeatures,
	rollupTone,
	type LedgerFeature,
	type UserIntent,
} from '../src/index'

const feat = (id: string, lifecycle: LedgerFeature['lifecycle']): LedgerFeature => ({
	id,
	label: id,
	areaId: 'a',
	lifecycle,
})

describe('honest health math', () => {
	it('only live is fully up; deferred/planned/not_built/unknown are down', () => {
		expect(lifecycleHealth('live')).toBe('up')
		expect(lifecycleHealth('built')).toBe('partial')
		expect(lifecycleHealth('beta')).toBe('partial')
		expect(lifecycleHealth('partial')).toBe('partial')
		expect(lifecycleHealth('deferred')).toBe('down')
		expect(lifecycleHealth('planned')).toBe('down')
		expect(lifecycleHealth('not_built')).toBe('down')
		expect(lifecycleHealth('unknown')).toBe('down')
	})

	it('weights up=100, partial=50, down=0', () => {
		expect(healthValue('up')).toBe(100)
		expect(healthValue('partial')).toBe(50)
		expect(healthValue('down')).toBe(0)
	})

	it('rolls a feature set up to an honest % (deferred + not-built drag it down)', () => {
		// 100 (live) + 50 (built) + 0 (planned) + 0 (deferred) = 150 / 4 = 37.5 → 38
		const s = rollupFeatures([
			feat('a', 'live'),
			feat('b', 'built'),
			feat('c', 'planned'),
			feat('d', 'deferred'),
		])
		expect(s.total).toBe(4)
		expect(s.healthPct).toBe(38)
	})

	it('rollupTone thresholds: >=80 green, >=34 yellow, else red; empty neutral', () => {
		expect(rollupTone({ healthPct: 90, total: 2, counts: [] })).toBe('green')
		expect(rollupTone({ healthPct: 50, total: 2, counts: [] })).toBe('yellow')
		expect(rollupTone({ healthPct: 10, total: 2, counts: [] })).toBe('red')
		expect(rollupTone({ healthPct: 0, total: 0, counts: [] })).toBe('neutral')
	})

	it('lifecycleTone keeps the build nuance the health axis flattens', () => {
		expect(lifecycleTone('built', 'down')).toBe('red') // built-but-broken → fix this
		expect(lifecycleTone('built')).toBe('yellow')
		expect(lifecycleTone('beta')).toBe('beta')
		expect(lifecycleTone('deferred')).toBe('stale')
		expect(lifecycleTone('not_built')).toBe('planned')
		expect(lifecycleTone('live')).toBe('live')
	})

	it('intent health averages its workflows', () => {
		const i: UserIntent = {
			id: 'i',
			label: 'i',
			lifecycle: 'built',
			workflows: [
				{ id: 'a', label: 'a', lifecycle: 'live' }, // 100
				{ id: 'b', label: 'b', lifecycle: 'not_built' }, // 0
			],
		}
		expect(intentHealth(i)).toBe('partial') // avg 50
	})

	it('a feature health override wins over lifecycle', () => {
		expect(featureHealth({ ...feat('x', 'built'), health: 'down' })).toBe('down')
	})
})
