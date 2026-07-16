import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Component } from 'vue'
import type { Ledger } from '@statusmap/core'

const ledger: Ledger = {
	generatedAt: '2026-06-22T10:00:00Z',
	areas: [{ id: 'sales', label: 'Sales', summary: 'Sales workflows', order: 1 }],
	features: [
		{
			id: 'sync',
			label: 'Sync contacts',
			areaId: 'sales',
			lifecycle: 'built',
			summary: 'Keeps CRM contacts aligned with the source system.',
			intents: [{ id: 'push', label: 'Push contact edits', lifecycle: 'live' }],
		},
	],
}

async function loadExplorer(): Promise<Component> {
	const mod = await import('../src/StatusMapExplorer.vue').catch(() => null)
	expect(mod?.default).toBeDefined()
	return mod!.default
}

describe('StatusMapExplorer', () => {
	it('renders the overview from props-driven generators with router-agnostic links', async () => {
		const StatusMapExplorer = await loadExplorer()
		const wrapper = mount(StatusMapExplorer, {
			props: {
				ledger,
				basePath: '/maps/status',
				brand: 'Acme',
			},
		})

		expect(wrapper.find('.status-map-page__title').text()).toBe('Acme — Status map')
		expect(wrapper.find('.status-explorer__crumb').text()).toBe('Status tree')
		expect(wrapper.find('.status-explorer__crumb').attributes('href')).toBe('/maps/status')
		expect(wrapper.find('.status-explorer__view--active').text()).toBe('Grouped')
		// Legend + flow render for real now (registry is complete — no placeholders)
		expect(wrapper.text()).not.toContain('Unrendered section')
		expect(wrapper.find('.status-map-flow').exists()).toBe(true)
		expect(wrapper.text()).toContain('Beta-test ready') // review filter chip
		expect(wrapper.text()).toContain('Built / partial') // a legend item
		expect(wrapper.text()).toContain('Sales') // the area node in the flow grid
	})

	it('renders feature detail from props and preserves the toned panel output', async () => {
		const StatusMapExplorer = await loadExplorer()
		const wrapper = mount(StatusMapExplorer, {
			props: {
				ledger,
				basePath: '/maps/status',
				feature: 'sync',
			},
		})

		const crumbs = wrapper.findAll('.status-explorer__crumb')
		expect(crumbs).toHaveLength(3)
		expect(crumbs[1]?.text()).toBe('Sales')
		expect(crumbs[1]?.attributes('href')).toBe('/maps/status?area=sales')
		expect(crumbs[2]?.text()).toBe('Sync contacts')
		expect(wrapper.text()).toContain('Keeps CRM contacts aligned with the source system.')
		expect(wrapper.text()).toContain('Push contact edits') // the intent card renders

		const panel = wrapper.find('.status-map-panel')
		expect(panel.exists()).toBe(true)
		expect(panel.attributes('style') || '').toContain('--tone-bg')
	})

	it('the review filter prunes the rendered map (verdict axis)', async () => {
		const led: Ledger = {
			areas: [
				{ id: 'a1', label: 'Area One', order: 1 },
				{ id: 'a2', label: 'Area Two', order: 2 },
			],
			features: [
				{
					id: 'good',
					label: 'Good',
					areaId: 'a1',
					lifecycle: 'live',
					intents: [{ id: 'g', label: 'G', lifecycle: 'live', coverage: { proofLevel: 'destination', passing: true } }],
				},
				{
					id: 'bad',
					label: 'Bad',
					areaId: 'a2',
					lifecycle: 'partial',
					intents: [{ id: 'b', label: 'B', lifecycle: 'partial', health: 'down', coverage: { proofLevel: 'owning_e2e', passing: false } }],
				},
			],
		}
		const StatusMapExplorer = await loadExplorer()
		const wrapper = mount(StatusMapExplorer, { props: { ledger: led } })

		// Both areas present before filtering
		expect(wrapper.text()).toContain('Area One')
		expect(wrapper.text()).toContain('Area Two')

		// Toggle the "Failing" verdict chip
		const failing = wrapper.findAll('button').find((b) => b.text() === 'Failing')
		expect(failing).toBeDefined()
		await failing!.trigger('click')

		// Only the area containing the failing intent survives; the banner reports the prune
		expect(wrapper.text()).not.toContain('Area One')
		expect(wrapper.text()).toContain('Area Two')
		expect(wrapper.text()).toContain('1 / 2 features')
	})

	it('shows an honest no-match recovery instead of a synthetic zero-percent project', async () => {
		const StatusMapExplorer = await loadExplorer()
		const wrapper = mount(StatusMapExplorer, { props: { ledger } })

		await wrapper.find('input[type="search"]').setValue('does-not-exist')
		await new Promise((resolve) => setTimeout(resolve, 225))
		await flushPromises()

		expect(wrapper.text()).toContain('No matches')
		expect(wrapper.text()).toContain('Nothing here matches the current filter.')
		expect(wrapper.text()).not.toContain('Working now: 0%')

		const clear = wrapper.findAll('button').find((button) => button.text() === 'Clear filter')
		expect(clear).toBeDefined()
		await clear!.trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Sales')
	})

	it.each([
		{ route: { feature: 'good' }, restored: 'Good' },
		{ route: { area: 'a1' }, restored: 'Area One' },
	])('offers filter recovery when the current drilled route is removed ($route)', async ({ route, restored }) => {
		const StatusMapExplorer = await loadExplorer()
		const drilledLedger: Ledger = {
			areas: [
				{ id: 'a1', label: 'Area One', order: 1 },
				{ id: 'a2', label: 'Area Two', order: 2 },
			],
			features: [
				{
					id: 'good',
					label: 'Good',
					areaId: 'a1',
					lifecycle: 'live',
					intents: [{ id: 'g', label: 'G', lifecycle: 'live', coverage: { proofLevel: 'destination', passing: true } }],
				},
				{
					id: 'bad',
					label: 'Bad',
					areaId: 'a2',
					lifecycle: 'partial',
					intents: [{ id: 'b', label: 'B', lifecycle: 'partial', coverage: { proofLevel: 'owning_e2e', passing: false } }],
				},
			],
		}
		const wrapper = mount(StatusMapExplorer, { props: { ledger: drilledLedger, ...route } })
		const failing = wrapper.findAll('button').find((button) => button.text() === 'Failing')
		expect(failing).toBeDefined()
		await failing!.trigger('click')
		await flushPromises()

		expect(wrapper.text()).toContain('No matches')
		expect(wrapper.text()).not.toContain('Not found')
		expect(wrapper.text()).not.toContain('← Back to the status tree')
		const clear = wrapper.findAll('button').find((button) => button.text() === 'Clear filter')
		expect(clear).toBeDefined()
		await clear!.trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain(restored)
	})

	it('does not show duplicate Not built controls for status and verdict', async () => {
		const StatusMapExplorer = await loadExplorer()
		const planned: Ledger = {
			areas: [{ id: 'future', label: 'Future', order: 1 }],
			features: [
				{
					id: 'later',
					label: 'Later',
					areaId: 'future',
					lifecycle: 'planned',
					intents: [{ id: 'idea', label: 'Idea', lifecycle: 'planned' }],
				},
			],
		}
		const wrapper = mount(StatusMapExplorer, { props: { ledger: planned } })

		expect(wrapper.findAll('button').filter((button) => button.text() === 'Not built')).toHaveLength(1)
	})
})
