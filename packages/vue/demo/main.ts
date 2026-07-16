import { createApp, h, type VNode } from 'vue'
// Canonical stylesheet now lives in @statusmap/core (the parallel styles-into-core move); import the
// core source directly so the demo themes without depending on the @statusmap/core package resolution.
import '../../core/src/styles/statusmap.css'
import { StatusMap, StatusMapPage } from '../src/index'
import { load as yamlLoad } from 'js-yaml'
import {
	createStatusMap,
	ledgerToQaScan,
	ledgerToFlat,
	buildTestResults,
	applyCoverageTests,
	type Ledger,
} from '../../core/src/index'

// The exact consumer quickstart: point import.meta.glob at a folder of YAML, hand it to the library.
// The public front door is the synthetic "Acme Notes" example. The framework's self-roadmap remains an
// optional dog-food view at ?demo=self.
const self = import.meta.glob('../../../examples/self-roadmap/**/*.yaml', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>
const acme = import.meta.glob('../../core/examples/ledger/**/*.yaml', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

// Real test artifacts the library INGESTS into failing-first proof trees: a genuine green @statusmap/core
// run + one clearly-labeled, non-gating known-failing fixture (an unbuilt-capability TDD result).
const artifacts = import.meta.glob('../../../examples/self-roadmap/artifacts/*.json', {
	import: 'default',
	eager: true,
}) as Record<string, unknown>

// Build the self-roadmap ledger, then overlay the real run trees onto the intents that own them (by
// owningE2e / matrix). This is the honest path: proof comes from ingested artifacts, never hand-authored.
function overlaidSelfLedger(): Ledger {
	const { ledger } = createStatusMap(self, (s) => yamlLoad(s) as unknown)
	const results = Object.values(artifacts).flatMap((vitestJson) => buildTestResults({ vitestJson }))
	return applyCoverageTests(ledger, results)
}

const params = new URLSearchParams(location.search)
const isSelf = params.get('demo') === 'self'
const view = params.get('view') // 'explore' | 'flat' | (default) qa

// A thin honesty bar above the self-roadmap: the one-sentence framing + the view switcher (Explore map).
function honestyBar(): VNode {
	const link = (href: string, label: string, active: boolean) =>
		h(
			'a',
			{
				href,
				style: {
					padding: '4px 10px',
					borderRadius: '999px',
					fontSize: '12px',
					fontWeight: '600',
					textDecoration: 'none',
					border: '1px solid var(--statusmap-border, #e2e8f0)',
					color: active ? 'var(--statusmap-page, #ffffff)' : 'var(--statusmap-text, #0f172a)',
					background: active ? 'var(--statusmap-active-fg, #0f766e)' : 'var(--statusmap-page, #fff)',
				},
			},
			label,
		)
	return h(
		'div',
		{
			style: {
				maxWidth: '60rem',
				margin: '0 auto',
				padding: '14px 20px 0',
				background: 'var(--statusmap-page, #ffffff)',
				display: 'flex',
				flexWrap: 'wrap',
				alignItems: 'center',
				gap: '10px',
				justifyContent: 'space-between',
			},
		},
		[
			h(
				'p',
				{
					style: {
						margin: '0',
						fontSize: '13px',
						lineHeight: '1.5',
						color: 'var(--statusmap-text, #0f172a)',
						maxWidth: '40rem',
					},
				},
				'This is statusmap mapping itself. Green appears only where a real artifact proves it; planned automation stays planned.',
			),
			h('nav', { style: { display: 'flex', gap: '6px', flex: 'none' } }, [
				link('?demo=self', 'What works now', !view),
				link('?demo=self&view=explore', 'Explore map', view === 'explore'),
				link('?demo=self&view=flat', 'All on one page', view === 'flat'),
			]),
		],
	)
}

const App = {
	render() {
		// The generic example: the plain <StatusMap :files> drop-in, unchanged.
		if (!isSelf) {
			return h(StatusMap, { files: acme, brand: 'Acme' })
		}

		const brand = 'AI Code-Maintenance Framework'
		const ledger = overlaidSelfLedger()

		// Explore = the drill-down explorer, fed the OVERLAID ledger so the ingested proof trees show.
		if (view === 'explore') {
			return h('div', [honestyBar(), h(StatusMap, { ledger, brand })])
		}
		// Flat = every feature on one page (a docs/export view).
		if (view === 'flat') {
			return h('div', [honestyBar(), h(StatusMapPage, { definition: ledgerToFlat(ledger, { brand }) })])
		}
		// Default front door = the QA-scan "What works now": one plain status per capability, problems first.
		return h('div', [honestyBar(), h(StatusMapPage, { definition: ledgerToQaScan(ledger, { brand }) })])
	},
}

createApp(App).mount('#app')
