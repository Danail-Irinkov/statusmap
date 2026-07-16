import { describe, it, expect } from 'vitest'
import {
	blockingFlag,
	intentBlockers,
	intentToCard,
	ledgerToArea,
	ledgerToFeatureDetail,
	ledgerToOverview,
	qaVerdict,
	testedVerdict,
	type Ledger,
	type UserIntent,
} from '../src/index'

describe('testedVerdict — the proof-level ladder', () => {
	it('maps proofLevel + passing to a verdict', () => {
		expect(testedVerdict(undefined).label).toBe('— Untested')
		expect(testedVerdict({ proofLevel: 'none' }).label).toBe('— Untested')
		expect(testedVerdict({ proofLevel: 'heuristic', passing: true }).label).toBe('~ Heuristic')
		expect(testedVerdict({ proofLevel: 'owning_e2e', passing: false }).label).toBe('✗ Failing')
		expect(testedVerdict({ proofLevel: 'owning_e2e', passing: true }).label).toBe('✓ Proven')
		expect(testedVerdict({ proofLevel: 'destination', passing: true }).label).toBe('✓ Proven')
		expect(testedVerdict({ proofLevel: 'unit', passing: true }).label).toBe('✓ Tested')
	})

	it('a heuristic stays weak (yellow) even when passing', () => {
		expect(testedVerdict({ proofLevel: 'heuristic', passing: true }).tone).toBe('yellow')
	})
})

describe('blockingFlag', () => {
	const intent = (over: Partial<UserIntent>): UserIntent => ({
		id: 'i',
		label: 'i',
		lifecycle: 'built',
		...over,
	})

	it('not_built / planned → Not built', () => {
		expect(blockingFlag(intent({ lifecycle: 'not_built' }), [])!.label).toBe('⚠ Not built')
		expect(blockingFlag(intent({ lifecycle: 'planned' }), [])!.label).toBe('⚠ Not built')
	})

	it('health down → Blocked', () => {
		expect(blockingFlag(intent({ lifecycle: 'built', health: 'down' }), [])!.label).toBe('⚠ Blocked')
	})

	it('counts workflow blockers', () => {
		expect(blockingFlag(intent({}), ['x'])!.label).toBe('⚠ 1 blocker')
		expect(blockingFlag(intent({}), ['x', 'y'])!.label).toBe('⚠ 2 blockers')
	})

	it('a clean intent shows NO flag (absence is the signal)', () => {
		expect(blockingFlag(intent({ lifecycle: 'live' }), [])).toBeUndefined()
	})
})

describe('intentBlockers', () => {
	it('collects down workflows + noted partial workflows', () => {
		const i: UserIntent = {
			id: 'i',
			label: 'i',
			lifecycle: 'partial',
			workflows: [
				{ id: 'a', label: 'A', lifecycle: 'not_built' },
				{ id: 'b', label: 'B', lifecycle: 'partial', health: 'partial', note: 'half done' },
				{ id: 'c', label: 'C', lifecycle: 'live' },
			],
		}
		const b = intentBlockers(i)
		expect(b).toHaveLength(2)
		expect(b[0]).toContain('A')
		expect(b[1]).toContain('half done')
	})
})

describe('intentToCard', () => {
	it('derives tested + blocking + blockers + coverage chips onto the card', () => {
		const i: UserIntent = {
			id: 'i',
			label: 'Replay edits',
			lifecycle: 'partial',
			health: 'down',
			note: 'drops edits',
			coverage: { proofLevel: 'owning_e2e', passing: false, owningE2e: 'replay' },
			workflows: [{ id: 'f', label: 'Flush', lifecycle: 'partial', health: 'down', note: 'too big' }],
		}
		const card = intentToCard(i)
		expect(card.tested!.label).toBe('✗ Failing')
		expect(card.blocking!.label).toBe('⚠ Blocked')
		expect(card.blockers).toEqual(['Flush: too big'])
		expect(card.coverage!.some((c) => c.label === 'owning_e2e')).toBe(true)
	})

	it('uses file:line run targets for playwright test nodes with steps', () => {
		const i: UserIntent = {
			id: 'i',
			label: 'Account dashboard',
			lifecycle: 'live',
			coverage: {
				proofLevel: 'owning_e2e',
				passing: true,
				owningE2e: 'account.spec.ts',
				testTree: [
					{
						name: 'opens the order detail',
						file: 'account.spec.ts',
						line: 42,
						status: 'passed',
						counts: { passed: 1, failed: 0, skipped: 0 },
						children: [
							{
								name: 'click order row',
								file: 'account.spec.ts',
								status: 'passed',
								counts: { passed: 1, failed: 0, skipped: 0 },
							},
						],
					},
				],
			},
		}
		const card = intentToCard(i, 'account')
		expect(card.testTree?.[0].run?.level).toBe('test')
		expect(card.testTree?.[0].run?.specs).toEqual(['account.spec.ts:42'])
	})

	it('uses owningE2e, not matrix tokens, as runnable specs', () => {
		const card = intentToCard(
			{
				id: 'i',
				label: 'Account dashboard',
				lifecycle: 'live',
				coverage: {
					proofLevel: 'owning_e2e',
					passing: true,
					owningE2e: 'account.spec.ts',
					matrix: 'account-matrix responsive',
				},
			},
			'account',
		)
		expect(card.run?.specs).toEqual(['account.spec.ts'])

		const matrixOnly = intentToCard({
			id: 'm',
			label: 'Matrix only',
			lifecycle: 'live',
			coverage: {
				proofLevel: 'owning_e2e',
				passing: true,
				matrix: 'account-matrix responsive',
			},
		})
		expect(matrixOnly.run).toBeUndefined()
	})
})

describe('qaVerdict', () => {
	it('shows proven beta lifecycle as beta-test ready', () => {
		const intent: UserIntent = {
			id: 'beta',
			label: 'Try the limited path',
			lifecycle: 'beta',
			coverage: { proofLevel: 'owning_e2e', passing: true },
		}
		expect(qaVerdict(intent)).toEqual({ label: '🧪 Beta-test ready', tone: 'beta' })
	})

	it('keeps unproven beta honest', () => {
		const intent: UserIntent = {
			id: 'beta',
			label: 'Try the limited path',
			lifecycle: 'beta',
			coverage: { proofLevel: 'heuristic', passing: true },
		}
		expect(qaVerdict(intent).label).toBe('🟡 Built · unproven')
	})
})

describe('ledgerToOverview branding', () => {
	const ledger: Ledger = {
		areas: [{ id: 'a', label: 'A' }],
		features: [{ id: 'f', label: 'F', areaId: 'a', lifecycle: 'live' }],
	}

	it('omits the brand by default, applies it when given', () => {
		expect(ledgerToOverview(ledger).meta.title).toBe('Status map')
		expect(ledgerToOverview(ledger).meta.eyebrow).toBe('Status tree')
		expect(ledgerToOverview(ledger, { brand: 'Acme' }).meta.title).toBe('Acme — Status map')
		expect(ledgerToOverview(ledger, { brand: 'Acme' }).meta.eyebrow).toBe('Acme · Status tree')
	})

	it('threads the basePath into drill links', () => {
		const def = ledgerToOverview(ledger, { basePath: '/map' })
		const flow = def.sections.find((s) => s.kind === 'flow')
		expect(flow?.kind === 'flow' && flow.nodes[0].to).toBe('/map?area=a')
	})
})

describe('scope progress badges', () => {
	const ledger: Ledger = {
		areas: [{ id: 'a', label: 'A' }],
		features: [
			{
				id: 'building',
				label: 'Building',
				areaId: 'a',
				lifecycle: 'built',
				progress: {
					stage: 'building',
					currentScope: [
						{ id: 'done-a', label: 'Done A', status: 'done' },
						{ id: 'done-b', label: 'Done B', status: 'done' },
						{ id: 'partial', label: 'Partial', status: 'partial' },
						{ id: 'planned', label: 'Planned', status: 'planned' },
						{ id: 'blocked', label: 'Blocked', status: 'blocked' },
					],
				},
			},
			{
				id: 'beta',
				label: 'Beta',
				areaId: 'a',
				lifecycle: 'beta',
				progress: { stage: 'beta_ready' },
			},
		],
	}

	it('shows working-now and scope-complete as separate header badges', () => {
		const def = ledgerToOverview(ledger)

		expect(def.meta.badges?.map((b) => b.label)).toContain('Working now: 50%')
		expect(def.meta.badges?.map((b) => b.label)).toContain('Scope complete: 72%')
	})

	it('adds scope progress to feature nodes', () => {
		const def = ledgerToArea(ledger, 'a')!
		const flow = def.sections.find((s) => s.kind === 'flow')
		const building = flow?.kind === 'flow' ? flow.nodes.find((n) => n.id === 'building') : undefined

		expect(building?.scopeProgress).toMatchObject({
			percent: 58,
			label: 'Scope complete',
			tone: 'yellow',
		})
	})

	it('shows scope progress in feature detail badges', () => {
		const def = ledgerToFeatureDetail(ledger, 'building')!

		expect(def.meta.badges?.map((b) => b.label)).toContain('Working now: Partial')
		expect(def.meta.badges?.map((b) => b.label)).toContain('Scope complete: 58%')
	})
})
