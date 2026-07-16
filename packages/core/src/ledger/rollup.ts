// Ledger math — resolve health, derive a tone, and roll a set of features up into a parent summary.
// Every constant lives in DEFAULT_STATUS_RULES (../status-rules); these functions apply it. The honest
// default: deferred / planned / not-built / unknown all resolve to `down` (0%) so a parent's "% up" is real.

import type { RollupSummary, StatusTone, ToneCount } from '../types'
import { DEFAULT_STATUS_RULES as RULES } from '../status-rules'
import type { Health, LedgerFeature, Lifecycle, UserIntent, Workflow } from './types'

export function lifecycleHealth(lc: Lifecycle): Health {
	return RULES.lifecycleHealth[lc]
}

export function healthValue(h: Health): number {
	return RULES.weights[h]
}

// A node's tone keeps the build nuance the health axis flattens: not-built/deferred read slate ("build
// this"), broken/blocked read red ("fix this"), beta gets its own attention label, partial yellow, live green.
export function lifecycleTone(lc: Lifecycle, health?: Health): StatusTone {
	if (health === 'down' && RULES.activeLifecycles.includes(lc)) {
		return RULES.healthOverrideTones.down
	}
	if (health === 'partial') {
		return RULES.healthOverrideTones.partial
	}
	return RULES.lifecycleTone[lc]
}

export function workflowHealth(w: Workflow): Health {
	return w.health ?? lifecycleHealth(w.lifecycle)
}

export function intentHealth(i: UserIntent): Health {
	if (i.health) {
		return i.health
	}
	// If an intent declares workflows, its health is the average of theirs; else from its lifecycle.
	if (i.workflows?.length) {
		const avg =
			i.workflows.reduce((s, w) => s + healthValue(workflowHealth(w)), 0) / i.workflows.length
		const { up, partial } = RULES.intentWorkflowThresholds
		return avg >= up ? 'up' : avg >= partial ? 'partial' : 'down'
	}
	return lifecycleHealth(i.lifecycle)
}

export function featureHealth(f: LedgerFeature): Health {
	return f.health ?? lifecycleHealth(f.lifecycle)
}

export function featureTone(f: LedgerFeature): StatusTone {
	return lifecycleTone(f.lifecycle, f.health)
}

export function rollupFeatures(features: LedgerFeature[]): RollupSummary {
	const total = features.length
	const healthPct = total
		? Math.round(features.reduce((s, f) => s + healthValue(featureHealth(f)), 0) / total)
		: 0
	const byTone = new Map<StatusTone, number>()
	for (const f of features) {
		const tone = featureTone(f)
		byTone.set(tone, (byTone.get(tone) || 0) + 1)
	}
	const counts: ToneCount[] = RULES.toneOrder
		.filter((t) => byTone.has(t))
		.map((tone) => ({ tone, count: byTone.get(tone) || 0 }))
	return { healthPct, total, counts }
}

// A parent grouping's tone, derived from its rollup health %.
export function rollupTone(summary: RollupSummary): StatusTone {
	if (summary.total === 0) {
		return 'neutral'
	}
	if (summary.healthPct >= RULES.rollupToneThresholds.green) {
		return 'green'
	}
	if (summary.healthPct >= RULES.rollupToneThresholds.yellow) {
		return 'yellow'
	}
	return 'red'
}

export function lifecycleLabel(lc: Lifecycle): string {
	return RULES.lifecycleLabel[lc]
}
