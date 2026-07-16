// createStatusMap — the one-call entry: a map of { path → raw YAML } in, a ready StatusMapBundle out.
//
// Built for Vite's
//   import.meta.glob('./status/**/*.yaml', { query: '?raw', import: 'default', eager: true })
// but any { path: rawYaml } map works (e.g. a Node fs walk). The areas doc is detected by the basename
// `areas.yaml`; every other file is a feature (a `_`-prefixed file is skipped). `parse` is injected so core
// stays dependency-free — pass js-yaml's `load`, or just use @statusmap/vue's <StatusMap>, which bundles one.

import { parseLedgerNetwork, type OnInvalid, type YamlParse } from './ledger/loaders'
import type { Ledger } from './ledger/types'

// The opaque result you hand to a renderer. Holds the validated ledger; you do not call the generators
// yourself — a renderer (e.g. @statusmap/vue's <StatusMap>) projects it into the views.
export type StatusMapBundle = {
	ledger: Ledger
}

export function createStatusMap(
	files: Record<string, string>,
	parse: YamlParse,
	opts: { generatedAt?: string; onInvalid?: OnInvalid } = {},
): StatusMapBundle {
	let areasYaml = ''
	const featureFiles: Record<string, string> = {}
	for (const [path, raw] of Object.entries(files)) {
		if (/(^|[\\/])areas\.ya?ml$/i.test(path)) {
			areasYaml = raw
		} else {
			featureFiles[path] = raw
		}
	}
	const ledger = parseLedgerNetwork(
		{ areasYaml, featureFiles, generatedAt: opts.generatedAt, onInvalid: opts.onInvalid },
		parse,
	)
	return { ledger }
}
