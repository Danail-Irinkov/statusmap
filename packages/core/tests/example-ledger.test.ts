import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load as yamlLoad } from 'js-yaml'
import {
	isFeatureFile,
	ledgerToArea,
	ledgerToFeatureDetail,
	ledgerToOverview,
	parseLedgerNetwork,
	rollupFeatures,
	validateLedger,
} from '../src/index'

const ledgerDir = fileURLToPath(new URL('../examples/ledger', import.meta.url))

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name)
		return statSync(p).isDirectory() ? walk(p) : [p]
	})
}

function loadExample() {
	const areasYaml = readFileSync(join(ledgerDir, 'areas.yaml'), 'utf8')
	const featuresDir = join(ledgerDir, 'features')
	const featureFiles: Record<string, string> = {}
	for (const abs of walk(featuresDir)) {
		if (abs.endsWith('.yaml')) featureFiles[relative(ledgerDir, abs)] = readFileSync(abs, 'utf8')
	}
	return parseLedgerNetwork({ areasYaml, featureFiles }, (s) => yamlLoad(s))
}

describe('example ledger (Acme Notes)', () => {
	it('loads + validates clean', () => {
		expect(validateLedger(loadExample())).toEqual([])
	})

	it('skips the _template.yaml authoring aid', () => {
		expect(isFeatureFile('features/_template.yaml')).toBe(false)
		expect(isFeatureFile('features/core/editor.yaml')).toBe(true)
		const ledger = loadExample()
		// editor, search, offline-sync, conflict-resolution, subscriptions, invoices — the template is skipped.
		expect(ledger.features).toHaveLength(6)
		expect(ledger.features.some((f) => f.id.startsWith('<'))).toBe(false)
	})

	it('rolls the whole app up honestly (deferred + planned drag it below half)', () => {
		// live 100 + built 50 + partial 50 + planned 0 + beta 50 + deferred 0 = 250 / 6 = 41.67 → 42
		const s = rollupFeatures(loadExample().features)
		expect(s.total).toBe(6)
		expect(s.healthPct).toBe(42)
	})

	it('projects into the three explorer levels', () => {
		const ledger = loadExample()
		expect(ledgerToOverview(ledger).sections.some((s) => s.kind === 'flow')).toBe(true)
		expect(ledgerToArea(ledger, 'sync')).not.toBeNull()
		const detail = ledgerToFeatureDetail(ledger, 'offline-sync')!
		const cards = detail.sections.find((s) => s.kind === 'cards')
		expect(cards?.kind === 'cards' && cards.items.some((i) => i.tested?.label === '✗ Failing')).toBe(true)
	})
})
