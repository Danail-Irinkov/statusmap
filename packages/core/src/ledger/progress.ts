import type { StatusTone } from '../types'
import type {
	Coverage,
	LedgerFeature,
	ProofLevel,
	ScopeProgressItem,
	ScopeProgressItemStatus,
	ScopeProgressLiveProof,
	ScopeProgressStage,
} from './types'

export type ScopeProgressCounts = {
	current: { total: number; done: number; partial: number; planned: number; blocked: number }
	excluded: { deferred: number; out_of_scope: number }
}

export type ScopeProgressSummary = {
	percent: number
	stage: ScopeProgressStage
	label: string
	tone: StatusTone
	inferred: boolean
	counts: ScopeProgressCounts
	liveProof: {
		successfulThreads: number
		successfulUsers: number
		targetThreads: number
		targetUsers: number
	}
}

export type ScopeProgressRollupSummary = {
	percent: number
	total: number
	tone: StatusTone
	inferred: boolean
}

const STAGE_LABEL: Record<ScopeProgressStage, string> = {
	planned: 'Planned',
	prd_ready: 'PRD ready',
	foundation: 'Foundation built',
	building: 'Building',
	tested: 'Test coverage',
	beta_ready: 'Beta-test ready',
	live_validation: 'Live validation',
	complete: 'Complete',
}

const DEFAULT_LIVE_THREADS = 3
const DEFAULT_LIVE_USERS = 2

function clamp01(n: number): number {
	return Math.max(0, Math.min(1, n))
}

function roundPct(n: number): number {
	return Math.max(0, Math.min(100, Math.round(n)))
}

export function scopeItemCompletion(status: ScopeProgressItemStatus | undefined): number {
	if (status === 'done') return 1
	if (status === 'partial') return 0.5
	return 0
}

function emptyCounts(): ScopeProgressCounts {
	return {
		current: { total: 0, done: 0, partial: 0, planned: 0, blocked: 0 },
		excluded: { deferred: 0, out_of_scope: 0 },
	}
}

function countItems(items: ScopeProgressItem[] | undefined, counts: ScopeProgressCounts) {
	for (const item of items || []) {
		if (item.status === 'deferred') {
			counts.excluded.deferred++
			continue
		}
		if (item.status === 'out_of_scope') {
			counts.excluded.out_of_scope++
			continue
		}
		counts.current.total++
		if (item.status === 'done') counts.current.done++
		else if (item.status === 'partial') counts.current.partial++
		else if (item.status === 'blocked') counts.current.blocked++
		else counts.current.planned++
	}
}

function scopeCounts(feature: LedgerFeature): ScopeProgressCounts {
	const counts = emptyCounts()
	countItems(feature.progress?.currentScope, counts)
	counts.excluded.deferred += feature.progress?.deferred?.length || 0
	counts.excluded.out_of_scope += feature.progress?.outOfScope?.length || 0
	return counts
}

function buildScopeScore(counts: ScopeProgressCounts): number {
	if (!counts.current.total) {
		return 40
	}
	const complete = counts.current.done + counts.current.partial * 0.5
	return 40 + 35 * (complete / counts.current.total)
}

function proofQuality(proof: ProofLevel | undefined): number {
	if (proof === 'destination') return 1
	if (proof === 'owning_e2e') return 0.75
	if (proof === 'unit') return 0.5
	if (proof === 'heuristic') return 0.25
	return 0
}

function coverageQualityOf(c: Coverage | undefined): number {
	if (!c || c.passing === false) return 0
	return proofQuality(c.proofLevel)
}

export function coverageQuality(feature: LedgerFeature): number {
	const intents = feature.intents || []
	if (!intents.length) {
		return 0
	}
	const sum = intents.reduce((s, intent) => s + coverageQualityOf(intent.coverage), 0)
	return sum / intents.length
}

function testedScore(feature: LedgerFeature): number {
	return 75 + 10 * coverageQuality(feature)
}

function normalizedLiveProof(proof: ScopeProgressLiveProof | undefined): ScopeProgressSummary['liveProof'] {
	return {
		successfulThreads: proof?.successfulThreads || 0,
		successfulUsers: proof?.successfulUsers || 0,
		targetThreads: proof?.targetThreads || DEFAULT_LIVE_THREADS,
		targetUsers: proof?.targetUsers || DEFAULT_LIVE_USERS,
	}
}

function liveValidationScore(proof: ScopeProgressSummary['liveProof']): number {
	const threadRatio = proof.targetThreads > 0 ? proof.successfulThreads / proof.targetThreads : 0
	const userRatio = proof.targetUsers > 0 ? proof.successfulUsers / proof.targetUsers : 0
	return 85 + 15 * clamp01(Math.max(threadRatio, userRatio))
}

function inferredStage(feature: LedgerFeature): ScopeProgressStage {
	if (feature.lifecycle === 'planned' || feature.lifecycle === 'not_built' || feature.lifecycle === 'unknown' || feature.lifecycle === 'deferred') {
		return feature.prd?.length ? 'prd_ready' : 'planned'
	}
	if (feature.lifecycle === 'partial') {
		return 'building'
	}
	if (feature.lifecycle === 'built') {
		return coverageQuality(feature) > 0 ? 'tested' : 'building'
	}
	if (feature.lifecycle === 'beta') {
		return 'beta_ready'
	}
	return 'beta_ready'
}

function explicitStageScore(feature: LedgerFeature, stage: ScopeProgressStage, counts: ScopeProgressCounts, liveProof: ScopeProgressSummary['liveProof']): number {
	if (stage === 'planned') return 0
	if (stage === 'prd_ready') return 20
	if (stage === 'foundation') return 40
	if (stage === 'building') return buildScopeScore(counts)
	if (stage === 'tested') return testedScore(feature)
	if (stage === 'beta_ready') return 85
	if (stage === 'live_validation') return liveValidationScore(liveProof)
	return 100
}

function inferredScore(feature: LedgerFeature, stage: ScopeProgressStage, counts: ScopeProgressCounts): number {
	if (stage === 'planned') return 0
	if (stage === 'prd_ready') return 20
	if (stage === 'building') return feature.lifecycle === 'built' ? 70 : buildScopeScore(counts)
	if (stage === 'tested') return Math.max(75, testedScore(feature))
	if (stage === 'beta_ready') return 85
	return 100
}

export function scopeProgressTone(input: number | { percent: number }): StatusTone {
	const percent = typeof input === 'number' ? input : input.percent
	if (percent >= 100) return 'live'
	if (percent >= 85) return 'beta'
	if (percent >= 40) return 'yellow'
	return 'planned'
}

export function featureScopeProgress(feature: LedgerFeature): ScopeProgressSummary {
	const counts = scopeCounts(feature)
	const stage = feature.progress?.stage || inferredStage(feature)
	const liveProof = normalizedLiveProof(feature.progress?.liveProof)
	const percent = feature.progress
		? roundPct(explicitStageScore(feature, stage, counts, liveProof))
		: roundPct(inferredScore(feature, stage, counts))

	return {
		percent,
		stage,
		label: STAGE_LABEL[stage],
		tone: scopeProgressTone(percent),
		inferred: !feature.progress,
		counts,
		liveProof,
	}
}

export function rollupScopeProgress(features: LedgerFeature[]): ScopeProgressRollupSummary {
	const summaries = features.map((feature) => featureScopeProgress(feature))
	const total = summaries.length
	if (!total) {
		return { percent: 0, total: 0, tone: 'neutral', inferred: true }
	}
	const percent = roundPct(summaries.reduce((s, summary) => s + summary.percent, 0) / total)
	return {
		percent,
		total,
		tone: scopeProgressTone(percent),
		inferred: summaries.every((summary) => summary.inferred),
	}
}
