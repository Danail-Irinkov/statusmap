// Runtime validation for a ledger assembled from YAML/JSON (the compile-time safety TS gives a code-authored
// ledger). Hand-rolled, zero-dependency. Returns a list of human-readable errors; empty === valid. Run it
// in your loader so a bad status value / broken ref fails loudly instead of silently dropping a feature.

import type {
	Coverage,
	Health,
	Ledger,
	LedgerFeature,
	Lifecycle,
	ProofLevel,
	ScopeProgressItem,
	ScopeProgressItemStatus,
	ScopeProgressStage,
	UserIntent,
	Workflow,
} from './types'

export const LIFECYCLES: Lifecycle[] = [
	'live',
	'built',
	'beta',
	'partial',
	'deferred',
	'planned',
	'not_built',
	'unknown',
]
export const HEALTHS: Health[] = ['up', 'partial', 'down']
export const PROOF_LEVELS: ProofLevel[] = ['destination', 'owning_e2e', 'unit', 'heuristic', 'none']
export const SCOPE_PROGRESS_STAGES: ScopeProgressStage[] = [
	'planned',
	'prd_ready',
	'foundation',
	'building',
	'tested',
	'beta_ready',
	'live_validation',
	'complete',
]
export const SCOPE_ITEM_STATUSES: ScopeProgressItemStatus[] = [
	'done',
	'partial',
	'planned',
	'blocked',
	'deferred',
	'out_of_scope',
]

function validateCoverage(c: Coverage | undefined, where: string, errs: string[]) {
	if (!c) {
		return
	}
	if (c.proofLevel !== undefined && !(PROOF_LEVELS as string[]).includes(c.proofLevel)) {
		errs.push(`${where}: bad coverage.proofLevel "${c.proofLevel}"`)
	}
	if (c.passing !== undefined && typeof c.passing !== 'boolean') {
		errs.push(`${where}: coverage.passing must be a boolean`)
	}
	// Display-only string fields. Guard the common authoring gotcha where an UNQUOTED date
	// (lastRun: 2026-06-19) parses to a YAML Date, not a string, and renders as a broken coverage chip.
	for (const k of ['owningE2e', 'matrix', 'lastRun', 'evidenceRef'] as const) {
		if (c[k] !== undefined && typeof c[k] !== 'string') {
			errs.push(`${where}: coverage.${k} must be a string (quote it — e.g. lastRun: '2026-06-19')`)
		}
	}
	if (c.tests !== undefined) {
		if (!Array.isArray(c.tests)) {
			errs.push(`${where}: coverage.tests must be an array`)
		} else {
			c.tests.forEach((t, i) => {
				const at = `${where}: coverage.tests[${i}]`
				if (!t || typeof t.name !== 'string' || !t.name.trim()) errs.push(`${at}: test missing name`)
				if (typeof t?.passing !== 'boolean') errs.push(`${at}: test.passing must be a boolean`)
				if (t?.file !== undefined && typeof t.file !== 'string') errs.push(`${at}: test.file must be a string`)
				if (t?.skipped !== undefined && typeof t.skipped !== 'boolean')
					errs.push(`${at}: test.skipped must be a boolean`)
			})
		}
	}
}

const isLifecycle = (v: unknown): v is Lifecycle =>
	typeof v === 'string' && (LIFECYCLES as string[]).includes(v)
const isHealth = (v: unknown): v is Health =>
	typeof v === 'string' && (HEALTHS as string[]).includes(v)
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

function validateProgressItem(item: ScopeProgressItem, where: string, errs: string[]) {
	if (!nonEmpty(item?.id)) errs.push(`${where}: progress item missing id`)
	if (!nonEmpty(item?.label)) errs.push(`${where}/${item?.id || '(no id)'}: progress item missing label`)
	if (!(SCOPE_ITEM_STATUSES as string[]).includes(item?.status)) {
		errs.push(`${where}/${item?.id || '(no id)'}: bad progress status "${item?.status}"`)
	}
	for (const k of ['note', 'evidenceRef'] as const) {
		if (item?.[k] !== undefined && typeof item[k] !== 'string') {
			errs.push(`${where}/${item.id || '(no id)'}: progress.${k} must be a string`)
		}
	}
}

function validateProgressItems(items: ScopeProgressItem[] | undefined, where: string, errs: string[]) {
	if (items === undefined) {
		return
	}
	if (!Array.isArray(items)) {
		errs.push(`${where}: must be an array`)
		return
	}
	items.forEach((item, i) => validateProgressItem(item, `${where}[${i}]`, errs))
}

function validateProgress(f: LedgerFeature, where: string, errs: string[]) {
	const p = f.progress
	if (!p) {
		return
	}
	if (!(SCOPE_PROGRESS_STAGES as string[]).includes(p.stage)) {
		errs.push(`${where}: bad progress.stage "${p.stage}"`)
	}
	for (const k of ['scopeRef', 'note'] as const) {
		if (p[k] !== undefined && typeof p[k] !== 'string') {
			errs.push(`${where}: progress.${k} must be a string`)
		}
	}
	validateProgressItems(p.currentScope, `${where}: progress.currentScope`, errs)
	validateProgressItems(p.deferred, `${where}: progress.deferred`, errs)
	validateProgressItems(p.outOfScope, `${where}: progress.outOfScope`, errs)
	if (p.liveProof) {
		for (const k of ['successfulThreads', 'successfulUsers', 'targetThreads', 'targetUsers'] as const) {
			const value = p.liveProof[k]
			if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
				errs.push(`${where}: progress.liveProof.${k} must be a non-negative number`)
			}
		}
		if (p.liveProof.evidenceRef !== undefined && typeof p.liveProof.evidenceRef !== 'string') {
			errs.push(`${where}: progress.liveProof.evidenceRef must be a string`)
		}
	}
}

function validateWorkflow(w: Workflow, where: string, errs: string[]) {
	if (!nonEmpty(w.id)) errs.push(`${where}: workflow missing id`)
	if (!nonEmpty(w.label)) errs.push(`${where}/${w.id}: workflow missing label`)
	if (!isLifecycle(w.lifecycle)) errs.push(`${where}/${w.id}: bad workflow lifecycle "${w.lifecycle}"`)
	if (w.health !== undefined && !isHealth(w.health))
		errs.push(`${where}/${w.id}: bad workflow health "${w.health}"`)
	validateCoverage(w.coverage, `${where}/${w.id}`, errs)
}

function validateIntent(i: UserIntent, where: string, errs: string[]) {
	if (!nonEmpty(i.id)) errs.push(`${where}: intent missing id`)
	if (!nonEmpty(i.label)) errs.push(`${where}/${i.id}: intent missing label`)
	if (!isLifecycle(i.lifecycle)) errs.push(`${where}/${i.id}: bad intent lifecycle "${i.lifecycle}"`)
	if (i.health !== undefined && !isHealth(i.health))
		errs.push(`${where}/${i.id}: bad intent health "${i.health}"`)
	if (i.lane !== undefined && !nonEmpty(i.lane))
		errs.push(`${where}/${i.id}: intent lane must be a non-empty string`)
	validateCoverage(i.coverage, `${where}/${i.id}`, errs)
	for (const w of i.workflows || []) validateWorkflow(w, `${where}/${i.id}`, errs)
}

function validateFeature(f: LedgerFeature, areaIds: Set<string>, errs: string[]) {
	const where = `feature ${f.id || '(no id)'}`
	if (!nonEmpty(f.id)) errs.push(`${where}: missing id`)
	if (!nonEmpty(f.label)) errs.push(`${where}: missing label`)
	if (!nonEmpty(f.areaId)) errs.push(`${where}: missing areaId`)
	else if (!areaIds.has(f.areaId)) errs.push(`${where}: areaId "${f.areaId}" is not a declared area`)
	if (!isLifecycle(f.lifecycle)) errs.push(`${where}: bad lifecycle "${f.lifecycle}"`)
	if (f.health !== undefined && !isHealth(f.health)) errs.push(`${where}: bad health "${f.health}"`)
	validateProgress(f, where, errs)
	for (const i of f.intents || []) validateIntent(i, where, errs)
}

// Returns a list of human-readable errors; empty === valid.
export function validateLedger(ledger: Ledger): string[] {
	const errs: string[] = []
	const areaIds = new Set<string>()
	for (const a of ledger.areas) {
		if (!nonEmpty(a.id)) errs.push('area: missing id')
		if (!nonEmpty(a.label)) errs.push(`area ${a.id}: missing label`)
		if (areaIds.has(a.id)) errs.push(`area ${a.id}: duplicate id`)
		areaIds.add(a.id)
	}
	const featureIds = new Set<string>()
	for (const f of ledger.features) {
		if (featureIds.has(f.id)) errs.push(`feature ${f.id}: duplicate id`)
		featureIds.add(f.id)
		validateFeature(f, areaIds, errs)
	}
	// Network refs: coveredChildIds must resolve to real features (a multi-word string is treated as a
	// descriptive note, not a broken id ref).
	for (const f of ledger.features) {
		for (const childId of f.coveredChildIds || []) {
			if (!featureIds.has(childId) && !isDescriptiveChild(childId)) {
				errs.push(`feature ${f.id}: coveredChildId "${childId}" does not resolve to a feature`)
			}
		}
	}
	return errs
}

function isDescriptiveChild(v: string): boolean {
	return /\s/.test(v)
}
