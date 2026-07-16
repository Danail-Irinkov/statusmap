// Regenerate core-vitest.json from a REAL @statusmap/core run — so the committed artifact is genuine,
// not hand-edited. Two steps (run from statusmap/):
//
//   node packages/core/node_modules/vitest/vitest.mjs run --root packages/core --reporter=json --outputFile=/tmp/core.json
//   node examples/self-roadmap/artifacts/_regen.mjs /tmp/core.json
//
// It keeps only the fields parseVitestJson reads, normalizes paths, and stamps _meta.capturedAt.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const raw = process.argv[2]
if (!raw) {
	console.error('usage: node _regen.mjs <raw-vitest-report.json>')
	process.exit(1)
}
const out = fileURLToPath(new URL('./core-vitest.json', import.meta.url))
const r = JSON.parse(readFileSync(raw, 'utf8'))

const testResults = r.testResults
	.map((f) => ({
		name: `packages/core/tests/${f.name.split(/[\\/]/).pop()}`,
		status: f.status,
		assertionResults: (f.assertionResults || []).map((a) => ({
			title: a.title,
			ancestorTitles: a.ancestorTitles || [],
			status: a.status,
		})),
	}))
	.sort((a, b) => a.name.localeCompare(b.name))

const today = new Date().toISOString().slice(0, 10)
const artifact = {
	_meta: {
		note: 'REAL @statusmap/core test run, captured for the self-roadmap demo. Ground truth — the library ingests this via parseVitestJson + applyCoverageTests to build the failing-first proof trees you see. Slimmed to the fields the parser reads.',
		producer: 'vitest',
		capturedAt: today,
		regenerate: 'see examples/self-roadmap/artifacts/_regen.mjs',
	},
	numTotalTests: r.numTotalTests,
	numPassedTests: r.numPassedTests,
	numFailedTests: r.numFailedTests,
	testResults,
}
writeFileSync(out, JSON.stringify(artifact, null, '\t') + '\n')
console.log('wrote', out, '—', r.numTotalTests, 'tests,', r.numFailedTests, 'failed')
