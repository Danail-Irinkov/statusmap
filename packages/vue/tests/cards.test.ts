import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CardsSection } from '@statusmap/core'
import StatusMapCards from '../src/StatusMapCards.vue'
import { createStatusMapFilter, STATUS_MAP_FILTER } from '../src/filter'

const section: CardsSection = {
	kind: 'cards',
	num: '03',
	title: 'Feature Status',
	subtitle: 'Per-intent coverage and blockers',
	items: [
		{
			name: 'Sync contacts',
			tone: 'red',
			statusLabel: 'Blocked',
			intent: 'Keeps CRM contacts in sync with the latest edits.',
			note: { marker: '1', text: 'API quota exhausted' },
			meta: [
				{ label: 'push', tone: 'red', title: 'Push flow is stalled' },
				{ label: 'pull', tone: 'yellow', title: 'Pull flow is delayed' },
			],
			coverage: [
				{ label: 'playwright', tone: 'green' },
				{ label: 'api-sync.spec.ts', mono: true },
			],
			tested: { label: '✗ Failing', tone: 'red' },
			blocking: { label: 'Blocked', tone: 'blocked' },
			blockers: ['Billing key is expired'],
			testTree: [
				{
					name: 'sync contacts',
					verdict: { label: '✗ Failing', tone: 'red' },
					passing: false,
					counts: { passed: 1, failed: 1, skipped: 0 },
					children: [
						{
							name: 'POST /sync returns 500',
							verdict: { label: '✗ Failing', tone: 'red' },
							passing: false,
							counts: { passed: 0, failed: 1, skipped: 0 },
						},
						{
							name: 'retries after refresh',
							verdict: { label: '✓ Passing', tone: 'green' },
							passing: true,
							counts: { passed: 1, failed: 0, skipped: 0 },
						},
					],
				},
			],
		},
		{
			name: 'Export invoices',
			tone: 'green',
			statusLabel: 'Live',
			tested: { label: '✓ Proven', tone: 'green' },
		},
	],
}

describe('StatusMapCards', () => {
	it('renders cards, honors the legend filter, and shows expanded proof details', async () => {
		const filter = createStatusMapFilter()
		filter.toggle('red')

		const wrapper = mount(StatusMapCards, {
			props: { section },
			global: {
				provide: {
					[STATUS_MAP_FILTER as symbol]: filter,
				},
			},
			attachTo: document.body,
		})

		expect(wrapper.find('.status-map-shell__title').text()).toBe('Feature Status')

		const cards = wrapper.findAll('.status-map-cards__card')
		expect(cards).toHaveLength(2)
		expect(cards[0]?.attributes('style') || '').not.toContain('display: none;')
		expect(cards[1]?.attributes('style') || '').toContain('display: none;')

		const primary = cards[0]!
		expect(primary.attributes('style') || '').toContain('--tone-bg')
		expect(primary.text()).toContain('Sync contacts')
		expect(primary.text()).toContain('✗ Failing')
		expect(primary.text()).toContain('Blocked')

		const details = primary.element as HTMLDetailsElement
		expect(details.open).toBe(false)
		await primary.find('summary').trigger('click')
		expect(details.open).toBe(true)

		expect(primary.text()).toContain('Workflows')
		expect(primary.text()).toContain('Coverage')
		expect(primary.text()).toContain('Tests')
		expect(primary.text()).toContain('Blocking')
		expect(primary.text()).toContain('Billing key is expired')
		expect(primary.text()).toContain('POST /sync returns 500')
		expect(primary.text()).toContain('✓ 1 passing')

		const chips = primary.findAll('[data-testid="status-map-chip"]')
		expect(chips).toHaveLength(2)
	})
})
