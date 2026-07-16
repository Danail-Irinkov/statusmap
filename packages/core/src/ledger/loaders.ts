// Loaders — assemble a validated `Ledger` from plain objects or a YAML network. Core stays dependency-free:
// the YAML path takes an INJECTED parser (e.g. `js-yaml`'s `load`), so consumers who pass already-parsed
// objects pull in no YAML library at all.

import { validateLedger } from './schema'
import type { Ledger, LedgerArea, LedgerFeature } from './types'

export type YamlParse = (src: string) => unknown
export type OnInvalid = 'throw' | 'warn' | 'ignore'

// A network file is a real feature UNLESS its basename is `_`-prefixed — that lets authoring aids
// (`_template.yaml`, scratch drafts) live beside the real features without rendering as a (broken) feature.
export function isFeatureFile(path: string): boolean {
	return !/(^|[\\/])_[^\\/]*\.ya?ml$/i.test(path)
}

function handleErrors(errs: string[], onInvalid: OnInvalid) {
	if (!errs.length) {
		return
	}
	const msg = `[statusmap] ledger validation failed (${errs.length}):\n- ${errs.slice(0, 25).join('\n- ')}`
	if (onInvalid === 'throw') {
		throw new Error(msg)
	}
	if (onInvalid === 'warn') {
		console.error(msg)
	}
}

// Assemble a validated Ledger from already-parsed plain objects (the dependency-free path). Features are
// sorted by id for a deterministic order independent of source/glob order.
export function assembleLedger(input: {
	areas: LedgerArea[]
	features: LedgerFeature[]
	generatedAt?: string
	onInvalid?: OnInvalid
}): Ledger {
	const features = [...input.features].sort((a, b) => a.id.localeCompare(b.id))
	const ledger: Ledger = { generatedAt: input.generatedAt, areas: input.areas, features }
	handleErrors(validateLedger(ledger), input.onInvalid ?? 'throw')
	return ledger
}

// Assemble from a YAML network (one areas doc + many feature docs) using an INJECTED parser. `featureFiles`
// maps a path → raw YAML; `_`-prefixed files are skipped.
export function parseLedgerNetwork(
	input: {
		areasYaml: string
		featureFiles: Record<string, string>
		generatedAt?: string
		onInvalid?: OnInvalid
	},
	parse: YamlParse,
): Ledger {
	const areas = ((parse(input.areasYaml) as LedgerArea[]) || []).filter(Boolean)
	const features = Object.entries(input.featureFiles)
		.filter(([path]) => isFeatureFile(path))
		.map(([, raw]) => parse(raw) as LedgerFeature)
		.filter(Boolean)
	return assembleLedger({
		areas,
		features,
		generatedAt: input.generatedAt,
		onInvalid: input.onInvalid,
	})
}
