// Per-intent test-ledger ingest. Turns REAL test-run artifacts (vitest/jest JSON + playwright JSON) into a
// navigable TestNode TREE overlaid onto an intent's coverage — so an explorer can drill
// file/describe-stages → test → e2e step (the "last mile"). Matrix-style describes collapse to one node
// with a roll-up. Pure functions only: read the artifacts yourself and call these. With no artifact, an
// intent keeps its hand-authored `coverage.tests` (static fallback).

import { mergeTags } from './tags'
import type { Coverage, Ledger, TestNode, TestStatus, UserIntent, Workflow } from './types'

export type RawStep = { name: string; status: TestStatus; steps?: RawStep[] }
export type RawTestResult = {
	name: string //         the test-case title (it() / spec title)
	file: string //         owning spec/test file
	line?: number //        source line when the runner reports one (Playwright JSON)
	suitePath: string[] //  the describe / suite chain above the test (the "stages")
	status: TestStatus
	steps?: RawStep[] //     e2e test.step() sub-steps (the last mile); unit tests have none
	tags?: string[] //       the spec's own tags plus those of every enclosing suite; absent when untagged
}

// Normalize a file path OR an owningE2e/spec token to a comparable join key.
export function testJoinKey(ref: string | undefined | null): string {
	const base = String(ref || '')
		.split(/[\\/]/)
		.pop()!
		.replace(/:\d+$/g, '')
	return base
		.replace(/\.(spec|test)\.[tj]sx?$/i, '')
		.replace(/\.[tj]sx?$/i, '')
		.trim()
		.toLowerCase()
}

function fileBase(ref: string): string {
	return String(ref || '').split(/[\\/]/).pop() || ref
}

function normVitestStatus(s: string | undefined): TestStatus | null {
	if (s === 'passed') return 'passed'
	if (s === 'failed') return 'failed'
	if (s === 'skipped' || s === 'todo' || s === 'pending' || s === 'disabled') return 'skipped'
	return null
}

// Vitest/Jest JSON: { testResults: [{ name: <file>, assertionResults: [{ title, ancestorTitles, status }] }] }.
export function parseVitestJson(raw: unknown): RawTestResult[] {
	const report = (raw || {}) as {
		testResults?: Array<{
			name?: string
			assertionResults?: Array<{
				title?: string
				fullName?: string
				ancestorTitles?: string[]
				status?: string
			}>
		}>
	}
	const out: RawTestResult[] = []
	for (const f of report.testResults || []) {
		for (const a of f.assertionResults || []) {
			const status = normVitestStatus(a.status)
			if (!status) continue
			out.push({
				name: a.title || a.fullName || '(unnamed test)',
				file: f.name || '',
				suitePath: (a.ancestorTitles || []).filter(Boolean),
				status,
			})
		}
	}
	return out
}

type PwStepRaw = { title?: string; error?: unknown; steps?: PwStepRaw[]; duration?: number }
type PwResult = { status?: string; steps?: PwStepRaw[] }
type PwTest = { results?: PwResult[]; status?: string }
type PwSpec = { title?: string; line?: number; ok?: boolean; tags?: string[]; tests?: PwTest[] }
type PwSuite = { title?: string; file?: string; tags?: string[]; specs?: PwSpec[]; suites?: PwSuite[] }

function worstStatus(statuses: TestStatus[]): TestStatus {
	if (statuses.some((s) => s === 'failed')) return 'failed'
	if (statuses.some((s) => s === 'passed')) return 'passed'
	return 'skipped'
}

function normPwStatus(s: string | undefined): TestStatus {
	if (s === 'failed' || s === 'timedOut' || s === 'interrupted') return 'failed'
	if (s === 'passed' || s === 'expected') return 'passed'
	return 'skipped'
}

// A playwright step → RawStep (recursive). A step with a recorded error reads failed; nested steps recurse.
function pwStep(s: PwStepRaw): RawStep {
	const children = (s.steps || []).map(pwStep)
	const status: TestStatus = children.length
		? worstStatus(children.map((c) => c.status))
		: s.error
			? 'failed'
			: 'passed'
	return { name: s.title || '(step)', status, ...(children.length ? { steps: children } : {}) }
}

// Playwright JSON: nested { suites: [{ title, file, tags?, specs: [{ title, tags?, tests:[{results:[{status,steps}]}] }], suites }] }.
// `tags` (optional) on a suite applies to every spec beneath it; on a spec, to that spec. Playwright's own
// reports already put `tags` (e.g. ['@smoke']) on specs.
export function parsePlaywrightJson(raw: unknown): RawTestResult[] {
	const report = (raw || {}) as { suites?: PwSuite[] }
	const out: RawTestResult[] = []
	const walk = (s: PwSuite, file: string | undefined, path: string[], inherited: string[]) => {
		const f = s.file || file
		const here = s.title ? [...path, s.title] : path
		const suiteTags = mergeTags(inherited, s.tags)
		for (const spec of s.specs || []) {
			const statuses: TestStatus[] = []
			let steps: RawStep[] | undefined
			for (const t of spec.tests || []) {
				if (t.status) statuses.push(normPwStatus(t.status))
				for (const r of t.results || []) {
					if (r.status) statuses.push(normPwStatus(r.status))
					if (r.steps?.length) steps = (steps || []).concat(r.steps.map(pwStep))
				}
			}
			const status = statuses.length ? worstStatus(statuses) : spec.ok === false ? 'failed' : 'passed'
			const tags = mergeTags(suiteTags, spec.tags)
			out.push({
				name: spec.title || '(spec)',
				file: f || '',
				...(typeof spec.line === 'number' ? { line: spec.line } : {}),
				suitePath: here,
				status,
				...(steps ? { steps } : {}),
				...(tags.length ? { tags } : {}),
			})
		}
		for (const child of s.suites || []) walk(child, f, here, suiteTags)
	}
	for (const s of report.suites || []) walk(s, undefined, [], [])
	return out
}

// ── join: which results belong to an intent ──────────────────────────────────────────────────────────
// A ref is a whitespace/comma separated token list. FILE tokens say which spec files it owns; the result
// matches when ANY file token matches its file. Every remaining "group" token (a matrix group) must appear in
// the result's suitePath/name, so `harness-matrix multilingual_robustness` pulls ONLY that group's cases.
//
// A token is a file token when it has a glob/path character (`*`, `{`, `/`) or ends in a test-file extension.
// It matches a result file when it equals the file's join key (basename, optional `:line`), or — as a glob
// (`*` within a directory, `**` any depth incl. none, `{a,b}` alternatives) — matches the END of the file's
// path on a segment boundary. Refs are relative to a test root the library doesn't know, so
// `Tabs/Contacts/*.cy.js` matches `cypress/e2e/Company/View/Tabs/Contacts/x.cy.js` but `List/*.cy.js` does
// not match `.../SubList/x.cy.js`. A ref with only group tokens matches nothing.
const FILE_EXT = /\.[cm]?[tj]sx?(?::\d+)?$/
const isFileToken = (t: string) => /[*{/]/.test(t) || FILE_EXT.test(t)

// Glob -> regex source anchored to the end of a '/'-normalized path, starting at a segment boundary.
function globToRegExp(glob: string): RegExp {
	let out = ''
	let depth = 0
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i]
		if (c === '*') {
			if (glob[i + 1] === '*') {
				i++
				if (glob[i + 1] === '/') {
					i++
					out += '(?:.*/)?'
				} else out += '.*'
			} else out += '[^/]*'
		} else if (c === '?') out += '[^/]'
		else if (c === '{') {
			depth++
			out += '(?:'
		} else if (c === '}' && depth > 0) {
			depth--
			out += ')'
		} else if (c === ',' && depth > 0) out += '|'
		else out += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
	}
	out += ')'.repeat(depth)
	return new RegExp(`(?:^|/)${out}$`)
}

export function refMatches(ref: string, r: RawTestResult): boolean {
	const tokens = ref
		.toLowerCase()
		.split(/\s+/)
		.map((t) => t.replace(/,+$/, ''))
		.filter(Boolean)
	if (!tokens.length) return false
	const fileKey = testJoinKey(r.file)
	if (!fileKey) return false
	const path = r.file.toLowerCase().replace(/\\/g, '/')
	const lineOf = (t: string) => Number(t.match(/:(\d+)$/)?.[1])
	const lineOk = (t: string) => {
		const line = lineOf(t)
		return !Number.isFinite(line) || r.line === line
	}
	const exact = tokens.find((t) => testJoinKey(t) === fileKey)
	const fileMatch = (t: string) => {
		if (!lineOk(t)) return false
		if (t === exact) return true
		return isFileToken(t) && globToRegExp(t.replace(/^\.?\//, '').replace(/:\d+$/, '')).test(path)
	}
	if (!tokens.some((t) => (t === exact || isFileToken(t)) && fileMatch(t))) return false
	const hay = `${r.suitePath.join(' ').toLowerCase()} ${r.name.toLowerCase()}`
	return tokens.filter((t) => t !== exact && !isFileToken(t)).every((g) => hay.includes(g))
}

export function resultsForIntent(
	results: RawTestResult[],
	joinRefs: Array<string | undefined>,
): RawTestResult[] {
	const refs = joinRefs.filter((r): r is string => !!r && !!r.trim())
	if (!refs.length) return []
	return results.filter((r) => refs.some((ref) => refMatches(ref, r)))
}

// ── tree build + rollup ───────────────────────────────────────────────────────────────────────────────
const countOne = (s: TestStatus) => ({
	passed: s === 'passed' ? 1 : 0,
	failed: s === 'failed' ? 1 : 0,
	skipped: s === 'skipped' ? 1 : 0,
})
const sumCounts = (nodes: TestNode[]) =>
	nodes.reduce(
		(a, n) => ({
			passed: a.passed + n.counts.passed,
			failed: a.failed + n.counts.failed,
			skipped: a.skipped + n.counts.skipped,
		}),
		{ passed: 0, failed: 0, skipped: 0 },
	)
const rollupStatus = (c: { passed: number; failed: number; skipped: number }): TestStatus =>
	c.failed > 0 ? 'failed' : c.passed > 0 ? 'passed' : 'skipped'

function stepToNode(s: RawStep, file?: string): TestNode {
	if (s.steps?.length) {
		const children = s.steps.map((c) => stepToNode(c, file))
		const counts = sumCounts(children)
		return { name: s.name, file, status: rollupStatus(counts), counts, children }
	}
	return { name: s.name, file, status: s.status, counts: countOne(s.status) }
}

type Builder = {
	name: string
	file?: string
	children: Map<string, Builder>
	leaf?: { status: TestStatus; steps?: RawStep[]; line?: number }
}

function finalize(b: Builder): TestNode {
	const line = typeof b.leaf?.line === 'number' ? { line: b.leaf.line } : {}
	const subs = [...b.children.values()]
	if (subs.length) {
		const children = subs.map(finalize)
		const counts = sumCounts(children)
		return { name: b.name, file: b.file, status: rollupStatus(counts), counts, children }
	}
	if (b.leaf?.steps?.length) {
		const children = b.leaf.steps.map((s) => stepToNode(s, b.file))
		const counts = sumCounts(children)
		return { name: b.name, file: b.file, ...line, status: rollupStatus(counts), counts, children }
	}
	const st = b.leaf?.status ?? 'skipped'
	return { name: b.name, file: b.file, ...line, status: st, counts: countOne(st) }
}

// Build the per-intent forest: top nodes are the first-level describes (or bare tests), drilling down to the
// leaf test, then e2e steps. The file is carried as node metadata (not its own level).
export function buildTestTree(results: RawTestResult[]): TestNode[] {
	const roots = new Map<string, Builder>()
	for (const r of results) {
		const path = [...r.suitePath, r.name]
		let level = roots
		let node: Builder | undefined
		for (let i = 0; i < path.length; i++) {
			const key = path[i]
			node = level.get(key)
			if (!node) {
				node = { name: key, file: fileBase(r.file), children: new Map() }
				level.set(key, node)
			}
			if (i === path.length - 1) node.leaf = { status: r.status, steps: r.steps, line: r.line }
			level = node.children
		}
	}
	return [...roots.values()].map(finalize)
}

// Merge artifacts, de-dup a repeated (file + suitePath + name) preferring fail/pass over skip.
export function buildTestResults(inputs: {
	vitestJson?: unknown
	playwrightJson?: unknown
}): RawTestResult[] {
	const all = [
		...(inputs.vitestJson ? parseVitestJson(inputs.vitestJson) : []),
		...(inputs.playwrightJson ? parsePlaywrightJson(inputs.playwrightJson) : []),
	]
	const byKey = new Map<string, RawTestResult>()
	const rank = (s: TestStatus) => (s === 'failed' ? 0 : s === 'passed' ? 1 : 2)
	for (const r of all) {
		const k = `${testJoinKey(r.file)}::${r.suitePath.join('>')}::${r.name}`
		const prev = byKey.get(k)
		const winner = !prev || rank(r.status) < rank(prev.status) ? r : prev
		// A repeated result keeps the union of both runs' tags so de-duping never drops a tag.
		const tags = mergeTags(prev?.tags, r.tags)
		byKey.set(k, tags.length ? { ...winner, tags } : winner)
	}
	return [...byKey.values()]
}

// Overlay the run tree onto matching intents (by owningE2e / matrix). Intents the run doesn't cover keep
// their hand-authored coverage.tests (static fallback). Pure; run it after the coverage-signal overlay.
export function applyCoverageTests(ledger: Ledger, results: RawTestResult[]): Ledger {
	if (!results.length) return ledger
	const overlay = (cov?: Coverage): Coverage | undefined => {
		if (!cov) return cov
		const tree = buildTestTree(resultsForIntent(results, [cov.owningE2e, cov.matrix]))
		if (!tree.length) return cov
		// Roll the REAL run up into `passing` so the derived verdict/tone reflect the artifact — not the
		// hand-authored bit. Any failed leaf → false; otherwise some-passed → true; all-skipped → keep prior.
		const c = sumCounts(tree)
		const passing = c.failed > 0 ? false : c.passed > 0 ? true : cov.passing
		return { ...cov, testTree: tree, passing }
	}
	// Tags ride along with the same match: every result that joins a node contributes its tags to that node.
	// Nodes with no tagged match are returned untouched (no empty `tags` key appears).
	const withTags = <T extends UserIntent | Workflow>(node: T): T => {
		const cov = node.coverage
		if (!cov) return node
		const matched = mergeTags(...resultsForIntent(results, [cov.owningE2e, cov.matrix]).map((r) => r.tags))
		return matched.length ? { ...node, tags: mergeTags(node.tags, matched) } : node
	}
	return {
		...ledger,
		features: ledger.features.map((f) => ({
			...f,
			intents: f.intents?.map((i) => {
				const tagged = withTags(i)
				return {
					...tagged,
					coverage: overlay(i.coverage),
					...(tagged.workflows ? { workflows: tagged.workflows.map(withTags) } : {}),
				}
			}),
		})),
	}
}
