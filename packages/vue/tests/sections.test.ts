import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type {
	FlowSection,
	LadderSection,
	LegendSection,
	MatrixSection,
	TimelineSection,
} from '@statusmap/core'
import StatusMapFlow from '../src/StatusMapFlow.vue'
import StatusMapLegend from '../src/StatusMapLegend.vue'
import StatusMapMatrix from '../src/StatusMapMatrix.vue'
import StatusMapLadder from '../src/StatusMapLadder.vue'
import StatusMapTimeline from '../src/StatusMapTimeline.vue'
import { createStatusMapFilter, STATUS_MAP_FILTER } from '../src/filter'

describe('StatusMapFlow', () => {
	it('renders linked nodes as router-agnostic links (default <a href>) + a rollup', () => {
		const section: FlowSection = {
			kind: 'flow',
			layout: 'grid',
			nodes: [
				{
					id: 'core',
					title: 'Core',
					tone: 'yellow',
					to: '/map?area=core',
					rollup: { healthPct: 50, total: 2, counts: [{ tone: 'live', count: 1 }] },
					scopeProgress: { percent: 58, label: 'Scope complete', tone: 'yellow', inferred: false },
				},
				{ id: 'plain', title: 'Plain node' },
			],
		}
		const wrapper = mount(StatusMapFlow, { props: { section } })
		const link = wrapper.find('a.status-map-flow__node')
		expect(link.exists()).toBe(true)
		expect(link.attributes('href')).toBe('/map?area=core')
		expect(wrapper.text()).toContain('Working now: 50%')
		expect(wrapper.text()).toContain('Scope complete: 58%')
		expect(wrapper.text()).toContain('Plain node')
	})
})

describe('StatusMapLegend', () => {
	it('renders filterable entries as buttons and toggles the shared filter on click', async () => {
		const filter = createStatusMapFilter()
		const section: LegendSection = {
			kind: 'legend',
			filters: true,
			items: [
				{ tone: 'live', label: 'Live' },
				{ tone: 'red', label: 'Down' },
			],
		}
		const wrapper = mount(StatusMapLegend, {
			props: { section },
			global: { provide: { [STATUS_MAP_FILTER as symbol]: filter } },
		})
		const buttons = wrapper.findAll('button.status-map-legend__hit')
		expect(buttons).toHaveLength(2)
		await buttons[0]!.trigger('click')
		expect(filter.isActive('live')).toBe(true)
		expect(buttons[0]!.classes()).toContain('status-map-legend__hit--active')
	})
})

describe('StatusMapMatrix', () => {
	it('renders a table with tone-tinted cells', () => {
		const section: MatrixSection = {
			kind: 'matrix',
			columns: ['Feature', 'Status'],
			rows: [{ label: 'Editor', cells: [{ tone: 'live', text: 'Live' }] }],
		}
		const wrapper = mount(StatusMapMatrix, { props: { section } })
		expect(wrapper.find('table').exists()).toBe(true)
		expect(wrapper.text()).toContain('Editor')
		const cell = wrapper.find('.status-map-matrix__cell')
		expect(cell.attributes('style') || '').toContain('--tone-bg')
	})
})

describe('StatusMapLadder', () => {
	it('renders numbered rungs with labels', () => {
		const section: LadderSection = {
			kind: 'ladder',
			rungs: [
				{ label: 'Read', tone: 'live' },
				{ label: 'Write', detail: 'mutate state' },
			],
		}
		const wrapper = mount(StatusMapLadder, { props: { section } })
		const rungs = wrapper.findAll('.status-map-ladder__rung')
		expect(rungs).toHaveLength(2)
		expect(wrapper.text()).toContain('Read')
		expect(wrapper.text()).toContain('mutate state')
	})
})

describe('StatusMapTimeline', () => {
	it('renders steps and emphasizes the current one', () => {
		const section: TimelineSection = {
			kind: 'timeline',
			steps: [
				{ rank: 'Now', title: 'Ship v1', current: true, tag: { label: 'active', tone: 'live' } },
				{ title: 'Later' },
			],
		}
		const wrapper = mount(StatusMapTimeline, { props: { section } })
		expect(wrapper.findAll('.status-map-timeline__step')).toHaveLength(2)
		expect(wrapper.find('.status-map-timeline__step--current').exists()).toBe(true)
		expect(wrapper.text()).toContain('Ship v1')
	})
})
