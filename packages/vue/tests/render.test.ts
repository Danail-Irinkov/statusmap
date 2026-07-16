import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { StatusMapDefinition } from '@statusmap/core'
import { StatusMapPage } from '../src/index'

const definition: StatusMapDefinition = {
	schemaVersion: 1,
	meta: {
		id: 'demo',
		eyebrow: 'Acme',
		title: 'Demo Map',
		subtitle: 'A rendered status map',
		badges: [{ label: 'Working now: 50%', tone: 'yellow' }],
	},
	sections: [
		{
			kind: 'header',
			num: '00',
			title: 'Overview',
			badges: [{ label: 'Live', tone: 'live', pulse: true }],
			chips: [{ label: 'scope', tone: 'neutral' }],
			note: 'a header note',
		},
		{
			kind: 'panel',
			num: '01',
			title: 'Callout',
			tone: 'red',
			body: 'something broke',
			bullets: ['fix a', 'fix b'],
			chips: [{ label: 'owner', mono: true }],
		},
	],
}

describe('StatusMapPage', () => {
	it('renders the masthead, a header section, and a toned panel', () => {
		const wrapper = mount(StatusMapPage, { props: { definition } })

		// Masthead
		expect(wrapper.find('.status-map-page__title').text()).toBe('Demo Map')
		expect(wrapper.find('.status-map-page__eyebrow').text()).toBe('Acme')

		// At least two status badges (the masthead's + the header section's)
		expect(wrapper.findAll('[data-testid="status-map-badge"]').length).toBeGreaterThanOrEqual(2)

		// Section content
		expect(wrapper.text()).toContain('Overview')
		expect(wrapper.text()).toContain('a header note')
		expect(wrapper.text()).toContain('something broke')
		expect(wrapper.text()).toContain('fix a')

		// Tone is applied via inline custom properties (no hard-coded color in the component)
		const panel = wrapper.find('.status-map-panel')
		expect(panel.exists()).toBe(true)
		expect(panel.attributes('style') || '').toContain('--tone-bg')
	})

	it('renders every catalogued section kind through the registry (no placeholders)', () => {
		const def: StatusMapDefinition = {
			schemaVersion: 1,
			meta: { id: 'x', title: 'X' },
			sections: [
				{ kind: 'matrix', columns: ['Feature'], rows: [{ label: 'Editor', cells: [{ tone: 'live', text: 'Live' }] }] },
			],
		}
		const wrapper = mount(StatusMapPage, { props: { definition: def } })
		expect(wrapper.find('table').exists()).toBe(true)
		expect(wrapper.text()).toContain('Editor')
		expect(wrapper.text()).not.toContain('Unrendered section')
	})
})
