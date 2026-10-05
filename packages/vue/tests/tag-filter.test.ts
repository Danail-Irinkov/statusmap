import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { StatusMap } from '../src/index'

// Real YAML (js-yaml is bundled by <StatusMap>): tags authored on a feature, an intent and a workflow.
// `editor` is also tagged from the test run (suite tag 'sanity' on the spec that owns its intent).
const files = {
	'status/areas.yaml': '- id: core\n  label: Core\n  order: 1\n- id: sync\n  label: Sync\n  order: 2',
	'status/features/core/editor.yaml': [
		'id: editor',
		'label: Editor',
		'areaId: core',
		'lifecycle: live',
		'intents:',
		'  - id: write',
		'    label: Write notes',
		'    lifecycle: live',
		'    coverage: { proofLevel: owning_e2e, owningE2e: editor.spec.ts, passing: true }',
		'  - id: format',
		'    label: Format text',
		'    lifecycle: partial',
		'    tags: [regression]',
		'    workflows:',
		'      - { id: bold, label: Bold, lifecycle: live, tags: [smoke] }',
	].join('\n'),
	'status/features/sync/offline.yaml': [
		'id: offline',
		'label: Offline',
		'areaId: sync',
		'lifecycle: partial',
		'intents:',
		'  - id: replay',
		'    label: Replay queue',
		'    lifecycle: partial',
		'    health: down',
	].join('\n'),
}

const playwrightJson = {
	suites: [
		{
			title: '',
			file: 'e2e/editor.spec.ts',
			tags: ['@sanity'],
			specs: [{ title: 'writes', ok: true, tests: [{ status: 'expected', results: [{ status: 'passed' }] }] }],
		},
	],
}

const chips = (w: ReturnType<typeof mount>) => w.findAll('[data-testid="status-map-tag-chip"]')
const chip = (w: ReturnType<typeof mount>, tag: string) => chips(w).find((c) => c.attributes('data-tag') === tag)!

describe('tag filter (StatusMap drop-in)', () => {
	it('renders no tag filter when the map has no tags', () => {
		const plain = { 'status/areas.yaml': files['status/areas.yaml'], 'status/features/sync/offline.yaml': files['status/features/sync/offline.yaml'] }
		const wrapper = mount(StatusMap, { props: { files: plain } })
		expect(wrapper.find('[data-testid="status-map-tag-filter"]').exists()).toBe(false)
	})

	it('renders one pressed-state chip per distinct tag, from authored YAML and the test report', () => {
		const wrapper = mount(StatusMap, { props: { files, playwrightJson } })
		expect(wrapper.find('[data-testid="status-map-tag-filter"]').attributes('aria-label')).toBe('Filter by tag')
		expect(chips(wrapper).map((c) => c.text())).toEqual(['regression', 'sanity', 'smoke'])
		for (const c of chips(wrapper)) expect(c.attributes('aria-pressed')).toBe('false')
	})

	it('selecting a tag hides untagged areas and keeps the tagged one; clearing restores the map', async () => {
		const wrapper = mount(StatusMap, { props: { files, playwrightJson } })
		expect(wrapper.text()).toContain('Sync')

		await chip(wrapper, 'sanity').trigger('click')
		await flushPromises()
		expect(chip(wrapper, 'sanity').attributes('aria-pressed')).toBe('true')
		expect(wrapper.text()).toContain('Core') // ancestor of the sanity-tagged intent stays
		expect(wrapper.text()).not.toContain('Sync')

		await wrapper.find('[data-testid="status-map-tag-clear"]').trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Sync')
		expect(wrapper.find('[data-testid="status-map-tag-clear"]').exists()).toBe(false)
	})

	it('is multi-select (OR within tags)', async () => {
		const wrapper = mount(StatusMap, { props: { files, playwrightJson } })
		await chip(wrapper, 'regression').trigger('click')
		await chip(wrapper, 'sanity').trigger('click')
		await flushPromises()
		expect(chips(wrapper).filter((c) => c.attributes('aria-pressed') === 'true')).toHaveLength(2)
		expect(wrapper.text()).toContain('Core')
		expect(wrapper.text()).not.toContain('Sync')
	})

	it('composes with the tone chips: a tag no matching-tone intent carries leaves no matches', async () => {
		const wrapper = mount(StatusMap, { props: { files, playwrightJson } })
		await chip(wrapper, 'sanity').trigger('click')
		const down = wrapper.findAll('.status-explorer__chip').find((c) => c.text() === 'Down')
		// "Down" only exists when something is down; the offline intent is, but it is not sanity-tagged.
		expect(down).toBeDefined()
		await down!.trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('No matches')
		await wrapper.find('.status-explorer__clear-filter').trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Sync')
	})

	it('preselects tags from initialTags and ignores tags the map does not carry', () => {
		const wrapper = mount(StatusMap, { props: { files, playwrightJson, initialTags: ['@sanity', 'nope'] } })
		expect(chip(wrapper, 'sanity').attributes('aria-pressed')).toBe('true')
		expect(chip(wrapper, 'smoke').attributes('aria-pressed')).toBe('false')
		expect(wrapper.text()).not.toContain('Sync')
	})
})
