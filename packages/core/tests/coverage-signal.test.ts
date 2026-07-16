import { describe, it, expect } from 'vitest'
import { applyCoverage, type CoverageSignal, type Ledger } from '../src/index'

const base = (): Ledger => ({
	areas: [{ id: 'a', label: 'A' }],
	features: [
		{
			id: 'f',
			label: 'F',
			areaId: 'a',
			lifecycle: 'built',
			intents: [{ id: 'i', label: 'I', lifecycle: 'built', lane: 'search', coverage: { proofLevel: 'heuristic' } }],
		},
	],
})

const sig = (over: Partial<CoverageSignal>): CoverageSignal => ({
	key: { lane: 'search' },
	verdict: 'pass',
	evidenceRef: 'r',
	producer: 'e2e',
	generatedAt: '2026-06-20',
	...over,
})

describe('applyCoverage — the honesty rules', () => {
	it('a pass raises proof at most to owning_e2e, never fabricates destination', () => {
		const out = applyCoverage(base(), [sig({ verdict: 'pass' })])
		const cov = out.features[0].intents![0].coverage!
		expect(cov.proofLevel).toBe('owning_e2e')
		expect(cov.passing).toBe(true)
	})

	it('a real fail forces health down (built-but-broken reads red)', () => {
		const out = applyCoverage(base(), [sig({ verdict: 'fail' })])
		expect(out.features[0].intents![0].health).toBe('down')
		expect(out.features[0].intents![0].coverage!.passing).toBe(false)
	})

	it('never downgrades a hand-authored destination on a machine pass', () => {
		const led = base()
		led.features[0].intents![0].coverage = { proofLevel: 'destination' }
		const out = applyCoverage(led, [sig({ verdict: 'pass' })])
		expect(out.features[0].intents![0].coverage!.proofLevel).toBe('destination')
	})

	it('honours producer precedence — the higher-ranked verdict wins for one target', () => {
		const out = applyCoverage(
			base(),
			[sig({ verdict: 'fail', producer: 'matrix' }), sig({ verdict: 'pass', producer: 'e2e' })],
			{ precedence: ['e2e', 'matrix'] },
		)
		expect(out.features[0].intents![0].coverage!.passing).toBe(true) // e2e (pass) outranks matrix (fail)
	})

	it('unknown / blocked verdicts keep the hand snapshot', () => {
		const out = applyCoverage(base(), [sig({ verdict: 'unknown' })])
		expect(out.features[0].intents![0].coverage!.proofLevel).toBe('heuristic')
	})
})
