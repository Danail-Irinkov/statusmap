import { describe, it, expect } from 'vitest'
import { statusTone, statusToneFamily, statusToneVars, type StatusTone } from '../src/index'

const ALL: StatusTone[] = [
	'live',
	'beta',
	'built',
	'planned',
	'green',
	'yellow',
	'red',
	'blocked',
	'stale',
	'unknown',
	'neutral',
]

describe('statusTone', () => {
	it('resolves every tone to a family + four package-namespaced tokens + a label', () => {
		for (const t of ALL) {
			const tok = statusTone(t)
			expect(tok.family).toBeTruthy()
			expect(tok.fg).toContain('--statusmap-')
			expect(tok.bg).toContain('--statusmap-')
			expect(tok.border).toContain('--statusmap-')
			expect(tok.dot).toContain('--statusmap-')
			expect(tok.label.length).toBeGreaterThan(0)
		}
	})

	it('collapses the health + planning vocab onto the five families', () => {
		expect(statusToneFamily('live')).toBe('done')
		expect(statusToneFamily('green')).toBe('done')
		expect(statusToneFamily('beta')).toBe('attention')
		expect(statusToneFamily('built')).toBe('attention')
		expect(statusToneFamily('yellow')).toBe('attention')
		expect(statusToneFamily('red')).toBe('problem')
		expect(statusToneFamily('blocked')).toBe('problem')
		expect(statusToneFamily('planned')).toBe('neutral')
		expect(statusToneFamily('stale')).toBe('neutral')
		expect(statusToneFamily('unknown')).toBe('neutral')
		expect(statusToneFamily('neutral')).toBe('neutral')
	})

	it('exposes tone vars for inline styles', () => {
		const vars = statusToneVars('live')
		expect(vars['--tone-fg']).toBe('var(--statusmap-done-fg)')
		expect(vars['--tone-dot']).toBe('var(--statusmap-done-dot)')
	})

	it('labels beta as beta-test ready', () => {
		expect(statusTone('beta').label).toBe('Beta-test ready')
	})
})
