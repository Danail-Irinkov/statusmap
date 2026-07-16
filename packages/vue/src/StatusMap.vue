<template>
	<StatusMapExplorer
		:ledger="ledger"
		:area="area"
		:feature="feature"
		:view="view"
		base-path=""
		:brand="brand"
		:feature-noun="featureNoun" />
</template>

<script setup lang="ts">
// The drop-in. Hand it your YAML files and it renders the whole thing — the 4 views, drill-down, and the
// review filter — with no router wiring:
//
//   const files = import.meta.glob('./status/**/*.yaml', { query: '?raw', import: 'default', eager: true })
//   <StatusMap :files="files" brand="Acme" />
//
// It parses the YAML (bundling js-yaml), builds the ledger via @statusmap/core's createStatusMap, and drives
// StatusMapExplorer with its OWN internal drill state — a link that updates that state instead of navigating,
// so it needs no vue-router / Nuxt. Pass `:ledger` instead of `:files` if you already have one, or `:parse`
// to use a different YAML parser.
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { load as yamlLoad } from 'js-yaml'
import {
	createStatusMap,
	buildTestResults,
	applyCoverageTests,
	parsePlaywrightJson,
	refMatches,
	type Ledger,
	type RawTestResult,
	type RunTarget,
	type StatusMapRunnerOptions,
	type YamlParse,
} from '@statusmap/core'
import StatusMapExplorer from './StatusMapExplorer.vue'
import { provideStatusMapLink } from './link'
import { provideStatusMapRunner, useStatusMapRunner } from './runner'

const props = defineProps<{
	files?: Record<string, string>
	ledger?: Ledger
	parse?: YamlParse
	brand?: string
	// Optional REAL test-run artifacts. Pass a parsed playwright (and/or vitest) JSON report and every intent
	// whose coverage.owningE2e/matrix matches a spec gets its real, failing-first test tree overlaid; intents
	// the run doesn't cover keep their hand-authored coverage. This is what makes the map test-DERIVED.
	playwrightJson?: unknown
	vitestJson?: unknown
	runner?: StatusMapRunnerOptions
	// L2-tier noun override (default 'feature'/'features'); pass { one: 'module', many: 'modules' } for ERP vocab.
	featureNoun?: { one: string; many: string }
}>()

// Internal drill state (uncontrolled — the whole point of the drop-in).
const area = ref<string | undefined>(undefined)
const feature = ref<string | undefined>(undefined)
const view = ref<'explore' | 'flat'>('explore')
const liveResults = ref<RawTestResult[]>([])
const liveRefs = ref<string[]>([])
const parentRunner = useStatusMapRunner()

function activeRunner(): StatusMapRunnerOptions | null {
	return props.runner ?? parentRunner
}

function rememberRunResult(target: RunTarget, report: unknown) {
	const fresh = parsePlaywrightJson(report)
	const refs = target.specs.filter((spec) => spec.trim())
	if (!fresh.length || !refs.length) return
	liveRefs.value = [...new Set([...liveRefs.value, ...refs])]
	liveResults.value = [...liveResults.value.filter((result) => !refs.some((ref) => refMatches(ref, result))), ...fresh]
}

const ledger = computed<Ledger>(() => {
	const parse: YamlParse = props.parse ?? ((s: string) => yamlLoad(s) as unknown)
	const base = props.ledger ?? createStatusMap(props.files ?? {}, parse).ledger
	if (props.playwrightJson || props.vitestJson || liveResults.value.length) {
		const staticResults = buildTestResults({ playwrightJson: props.playwrightJson, vitestJson: props.vitestJson })
		const staleRefs = liveRefs.value
		const results = [
			...staticResults.filter((result) => !staleRefs.some((ref) => refMatches(ref, result))),
			...liveResults.value,
		]
		return applyCoverageTests(base, results)
	}
	return base
})

provideStatusMapRunner({
	get enabled() {
		return activeRunner()?.enabled
	},
	get focus() {
		return activeRunner()?.focus
	},
	async listTests(target) {
		const runner = activeRunner()
		return runner?.listTests ? runner.listTests(target) : []
	},
	run: async function* (target) {
		const runner = activeRunner()
		if (!runner) return
		for await (const event of runner.run(target)) {
			if (event.type === 'result') {
				rememberRunResult(target, event.report)
			}
			yield event
		}
	},
})

// The Explorer's drill targets are `?area=…&feature=…` / `?view=flat` / '' (root). Parse them into state.
function applyTo(to: string) {
	const qi = to.indexOf('?')
	const params = new URLSearchParams(qi >= 0 ? to.slice(qi + 1) : '')
	view.value = params.get('view') === 'flat' ? 'flat' : 'explore'
	area.value = params.get('area') || undefined
	feature.value = params.get('feature') || undefined
}

// A link that updates internal state instead of navigating — provided to the Explorer + its sections.
const InternalLink = defineComponent({
	name: 'StatusMapInternalLink',
	props: { to: { type: String as PropType<string>, default: '' } },
	setup(p, { slots }) {
		return () =>
			h(
				'a',
				{
					href: p.to || '#',
					onClick: (e: MouseEvent) => {
						e.preventDefault()
						applyTo(p.to)
					},
				},
				slots.default ? slots.default() : [],
			)
	},
})

provideStatusMapLink({ component: InternalLink, prop: 'to' })
</script>
