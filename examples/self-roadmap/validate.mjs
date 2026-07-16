// Honest-demo validator — the anti-drift guard for the self-roadmap (a-thread risk mitigation).
// Run from statusmap/:  node examples/self-roadmap/validate.mjs
//
// It fails (exit 1) if the self-roadmap drifts away from artifact-backed proof:
//   1. any proof level above `heuristic` (unit / owning_e2e / destination) without a resolving evidenceRef;
//   2. proof hand-authored inline (coverage.tests / coverage.testTree in the YAML) — proof must be INGESTED;
//   3. a failing node (passing:false) not backed by a clearly-labeled, non-gating known-failure artifact.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(new URL('../../packages/core/package.json', import.meta.url))
const yaml = require('js-yaml')

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const featuresDir = `${here}features`
const STRONG = new Set(['unit', 'owning_e2e', 'destination'])
const errors = []

function walk(dir) {
	for (const e of readdirSync(dir)) {
		const p = `${dir}/${e}`
		if (statSync(p).isDirectory()) walk(p)
		else if (e.endsWith('.yaml') && !e.startsWith('_')) check(p)
	}
}

function resolveEvidence(ref) {
	const path = String(ref).split(' (')[0].trim() // strip "(via …)" suffixes
	return resolve(repoRoot, path)
}

function isIgnored(path) {
	return spawnSync('git', ['check-ignore', '--quiet', '--', path], { cwd: repoRoot }).status === 0
}

function check(file) {
	const doc = yaml.load(readFileSync(file, 'utf8'))
	const where = file.split(/[\\/]/).slice(-2).join('/')
	for (const intent of doc.intents || []) {
		const nodes = [intent, ...(intent.workflows || [])]
		for (const n of nodes) {
			const tag = `${where} › ${doc.id}/${n.id}`
			const c = n.coverage
			if (!c) continue
			if ('tests' in c || 'testTree' in c) {
				errors.push(`${tag}: proof is hand-authored (coverage.tests/testTree) — it must be INGESTED from an artifact.`)
			}
			if (c.proofLevel && STRONG.has(c.proofLevel) && !c.evidenceRef) {
				errors.push(`${tag}: proofLevel '${c.proofLevel}' has no evidenceRef.`)
			}
			if (c.evidenceRef) {
				const abs = resolveEvidence(c.evidenceRef)
				if (!existsSync(abs)) errors.push(`${tag}: evidenceRef does not resolve → ${c.evidenceRef}`)
				else if (isIgnored(abs)) errors.push(`${tag}: evidenceRef is git-ignored and will be absent from a clean clone → ${c.evidenceRef}`)
				else if (abs.endsWith('.json')) {
					const artifact = JSON.parse(readFileSync(abs, 'utf8'))
					if (c.passing === true && artifact.result && artifact.result !== 'passed') {
						errors.push(`${tag}: passing proof cites an artifact whose result is '${artifact.result}'.`)
					}
					// a failing node must cite a labeled, non-gating known-failure artifact (never a faked break)
					if (c.passing === false) {
						const meta = artifact._meta || {}
						if (!meta.nonGating) {
							errors.push(`${tag}: failing node's artifact is not marked _meta.nonGating — refuse to imply a real CI break.`)
						}
					}
				}
			}
		}
	}
}

walk(featuresDir)

if (errors.length) {
	console.error(`✗ self-roadmap honesty check FAILED (${errors.length}):`)
	for (const e of errors) console.error('  - ' + e)
	process.exit(1)
}
console.log('✓ self-roadmap honesty check passed — every non-none/non-heuristic proof is artifact-backed.')
