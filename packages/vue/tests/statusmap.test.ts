import { defineComponent, h } from 'vue'
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { provideStatusMapRunner, StatusMap } from '../src/index'

// The exact shape Vite's import.meta.glob('./status/**/*.yaml', { query: '?raw', eager: true }) returns.
const files = {
	'status/areas.yaml': '- id: core\n  label: Core\n  order: 1\n- id: sync\n  label: Sync\n  order: 2',
	'status/features/core/editor.yaml':
		'id: editor\nlabel: Editor\nareaId: core\nlifecycle: live\nintents:\n  - id: w\n    label: Write\n    lifecycle: live\n    coverage:\n      proofLevel: owning_e2e\n      owningE2e: editor.spec.ts\n      passing: true',
	'status/features/sync/offline.yaml':
		'id: offline\nlabel: Offline\nareaId: sync\nlifecycle: partial\nintents:\n  - id: r\n    label: Replay\n    lifecycle: partial\n    health: down',
}

describe('StatusMap (drop-in)', () => {
	it('parses YAML files and renders the overview', () => {
		const wrapper = mount(StatusMap, { props: { files, brand: 'Acme' } })
		expect(wrapper.find('.status-map-page__title').text()).toBe('Acme — Status map')
		expect(wrapper.text()).toContain('Core')
		expect(wrapper.text()).toContain('Sync')
		// the review-filter toolbar is present (the Explorer rides underneath)
		expect(wrapper.find('.status-explorer__filter').exists()).toBe(true)
	})

	it('drills into an area on click with no router (internal state)', async () => {
		const wrapper = mount(StatusMap, { props: { files } })
		const coreLink = wrapper.findAll('a.status-map-flow__node').find((a) => a.text().includes('Core'))
		expect(coreLink).toBeDefined()
		await coreLink!.trigger('click')
		await flushPromises()
		// now on the Core area view: its feature "Editor" renders and the area breadcrumb appears
		expect(wrapper.text()).toContain('Editor')
		const crumbs = wrapper.findAll('.status-explorer__crumb')
		expect(crumbs.some((c) => c.text() === 'Core')).toBe(true) // "Status tree › Core"
	})

	it('switches to the complete list view on click with no router', async () => {
		const wrapper = mount(StatusMap, { props: { files, brand: 'Acme' } })
		const list = wrapper.findAll('.status-explorer__view').find((link) => link.text() === 'List')
		expect(list).toBeDefined()
		await list!.trigger('click')
		await flushPromises()

		expect(wrapper.find('.status-map-page__title').text()).toBe('Acme — Status map (All)')
		expect(wrapper.text()).toContain('Editor')
		expect(wrapper.text()).toContain('Offline')
		expect(wrapper.find('.status-explorer__view--active').text()).toBe('List')
		expect(wrapper.find('.status-explorer__view--active').attributes('aria-current')).toBe('page')
	})

	it('keeps the map unchanged without a runner and shows Run on owning e2e nodes when enabled', async () => {
		const wrapper = mount(StatusMap, { props: { files } })
		expect(wrapper.find('[data-statusmap-run]').exists()).toBe(false)

		await wrapper.setProps({
			runner: {
				enabled: true,
				run: async function* () {},
			},
		})
		await flushPromises()
		const coreLink = wrapper.findAll('a.status-map-flow__node').find((a) => a.text().includes('Core'))
		await coreLink!.trigger('click')
		await flushPromises()
		const flowRun = wrapper.find('button.status-map-flow__run')
		expect(flowRun.exists()).toBe(true)
		expect(flowRun.element.closest('a')).toBeNull()
		const editorLink = wrapper.findAll('a.status-map-flow__node').find((a) => a.text().includes('Editor'))
		await editorLink!.trigger('click')
		await flushPromises()

		const buttons = wrapper.findAll('[data-statusmap-run]')
		expect(buttons.length).toBeGreaterThan(0)
		expect(buttons.some((button) => button.text().includes('Run'))).toBe(true)
	})

	it('uses an ancestor runner provider when the drop-in runner prop is absent', async () => {
		const Host = defineComponent({
			setup() {
				provideStatusMapRunner({
					enabled: true,
					run: async function* () {},
				})
				return () => h(StatusMap, { files })
			},
		})
		const wrapper = mount(Host)

		const coreLink = wrapper.findAll('a.status-map-flow__node').find((a) => a.text().includes('Core'))
		await coreLink!.trigger('click')
		await flushPromises()
		const editorLink = wrapper.findAll('a.status-map-flow__node').find((a) => a.text().includes('Editor'))
		await editorLink!.trigger('click')
		await flushPromises()

		expect(wrapper.find('[data-statusmap-run]').exists()).toBe(true)
	})
})
