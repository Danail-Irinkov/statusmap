// The status rules — every opinionated heuristic in ONE documented place. READ-ONLY: this is the library's
// honest-accounting doctrine, not a configuration surface. Read it to understand exactly what the library
// decides (only shipped + proven work is fully `up`; deferred / planned / not-built work counts as `down`).
// Exported for reference + docs, not for per-call override.

import type { LegendItem, StatusTone } from './types'
import type { Health, Lifecycle, ProofLevel } from './ledger/types'

// The five CSS token families a tone collapses onto (the renderer styles `--statusmap-<family>-*`).
export type StateFamily = 'done' | 'attention' | 'problem' | 'neutral' | 'active'

// The shape of the rules object (a reference type; the library ships exactly one value, DEFAULT_STATUS_RULES).
export type StatusRules = {
	// Health math: the weight of each health value (a rollup averages these); which health a lifecycle
	// resolves to (only `live` is up; built/beta/partial = partial; the rest = down); and the workflow-average
	// thresholds for an intent's health.
	weights: Record<Health, number>
	lifecycleHealth: Record<Lifecycle, Health>
	intentWorkflowThresholds: { up: number; partial: number }
	// Tone: the base tone per lifecycle; which lifecycles a `down` health flips to red; the override tones; the
	// rollup-colour cutoffs; the tone listing order; and each tone's CSS family + human label.
	lifecycleTone: Record<Lifecycle, StatusTone>
	activeLifecycles: Lifecycle[]
	healthOverrideTones: { down: StatusTone; partial: StatusTone }
	rollupToneThresholds: { green: number; yellow: number }
	toneOrder: StatusTone[]
	toneFamily: Record<StatusTone, StateFamily>
	toneLabel: Record<StatusTone, string>
	// Proof / coverage honesty: the proof ladder (weakest → strongest) and the cap a machine signal may reach.
	proofLadder: ProofLevel[]
	machineProofCap: ProofLevel
	// Labels + legend copy.
	lifecycleLabel: Record<Lifecycle, string>
	legend: LegendItem[]
}

// The honest defaults. Everything the library decides, in one object.
export const DEFAULT_STATUS_RULES: StatusRules = {
	weights: { up: 100, partial: 50, down: 0 },
	lifecycleHealth: {
		live: 'up',
		built: 'partial',
		beta: 'partial',
		partial: 'partial',
		deferred: 'down',
		planned: 'down',
		not_built: 'down',
		unknown: 'down',
	},
	intentWorkflowThresholds: { up: 75, partial: 25 },

	lifecycleTone: {
		live: 'live',
		built: 'yellow',
		beta: 'beta',
		partial: 'yellow',
		deferred: 'stale',
		planned: 'planned',
		not_built: 'planned',
		unknown: 'unknown',
	},
	activeLifecycles: ['live', 'built', 'beta', 'partial'],
	healthOverrideTones: { down: 'red', partial: 'yellow' },
	rollupToneThresholds: { green: 80, yellow: 34 },
	toneOrder: ['live', 'green', 'beta', 'yellow', 'red', 'blocked', 'stale', 'planned', 'unknown', 'neutral'],
	toneFamily: {
		live: 'done',
		green: 'done',
		beta: 'attention',
		built: 'attention',
		yellow: 'attention',
		red: 'problem',
		blocked: 'problem',
		planned: 'neutral',
		unknown: 'neutral',
		stale: 'neutral',
		neutral: 'neutral',
	},
	toneLabel: {
		live: 'Live',
		green: 'Green',
		beta: 'Beta-test ready',
		built: 'Built',
		yellow: 'Yellow',
		red: 'Red',
		blocked: 'Blocked',
		planned: 'Planned',
		unknown: 'Unknown',
		stale: 'Stale',
		neutral: 'Neutral',
	},

	proofLadder: ['none', 'heuristic', 'unit', 'owning_e2e', 'destination'],
	machineProofCap: 'owning_e2e',

	lifecycleLabel: {
		live: 'Live',
		built: 'Built',
		beta: 'Beta-test ready',
		partial: 'Partial',
		deferred: 'Deferred',
		planned: 'Planned',
		not_built: 'Not built',
		unknown: 'Unknown',
	},
	legend: [
		{ tone: 'live', label: 'Live', hint: 'shipped + proven (100%)' },
		{ tone: 'beta', label: 'Beta-test ready', hint: 'limited working path with proof (50%)' },
		{ tone: 'yellow', label: 'Built / partial', hint: 'implemented, not live-proven (50%)' },
		{ tone: 'red', label: 'Down', hint: 'broken / blocked (0%)' },
		{ tone: 'stale', label: 'Deferred', hint: 'intentionally parked (0%)' },
		{ tone: 'planned', label: 'Not built', hint: 'designed, not built (0%)' },
	],
}
