// The unified coverage-signal contract + the ONE generic overlay ("status derives from the tests").
//
// Every test producer (a CI run, a QA matrix, a runtime-health feed, …) is normalized to a flat
// `CoverageSignal[]`; `applyCoverage` merges them onto the ledger, the highest-precedence producer winning
// per target. Adding a producer = a normalizer (yours) + a precedence entry — NO change here.
//
// Honesty rules (DEFAULT_STATUS_RULES proof ladder): a machine signal proves at most `machineProofCap` — it
// NEVER fabricates the human-only top of the ladder and never DOWNGRADES a hand-authored claim. A real
// `fail` forces `health: down` so a built-but-broken intent reads red, not green.

import { DEFAULT_STATUS_RULES as RULES } from '../status-rules'
import type { Health, Ledger, ProofLevel, UserIntent } from './types'

export type CoverageVerdict = 'pass' | 'partial' | 'fail' | 'unknown' | 'blocked'

// At least one key must be set. `lane` joins to UserIntent.lane; `intentId` to UserIntent.id; `featureId`
// is reserved for feature-level producers.
export type CoverageKey = { featureId?: string; lane?: string; intentId?: string }

export type CoverageSignal = {
	key: CoverageKey
	verdict: CoverageVerdict
	proofLevel?: ProofLevel //  the producer's own proof level; capped at machineProofCap for machine signals
	evidenceRef: string //      producer/run pointer, e.g. 'ci-run/<id>'
	producer: string //         your producer id, e.g. 'unit' | 'e2e' | 'qa-matrix'
	generatedAt: string //      ISO/date of the run
}

export type ApplyCoverageOptions = {
	// Most → least authoritative producer ids. A higher-precedence producer's verdict wins for one target.
	// Producers not listed rank last (insertion order among them). Default: [] (all equal; first wins).
	precedence?: string[]
}

// A pass may RAISE proof up to the cap but never lowers a stronger existing claim.
function raiseProof(existing: ProofLevel | undefined, to: ProofLevel): ProofLevel {
	const ladder = RULES.proofLadder
	return ladder.indexOf(existing ?? 'none') >= ladder.indexOf(to) ? (existing ?? to) : to
}

function push(map: Map<string, CoverageSignal[]>, key: string, s: CoverageSignal) {
	const arr = map.get(key)
	if (arr) arr.push(s)
	else map.set(key, [s])
}

// Apply one winning signal to an intent, honestly.
function applyVerdict(intent: UserIntent, s: CoverageSignal): UserIntent {
	if (s.verdict === 'unknown' || s.verdict === 'blocked') {
		return intent //  no live evidence either way → keep the hand snapshot
	}
	const passing = s.verdict === 'pass'
	const proofLevel: ProofLevel | undefined =
		s.verdict === 'pass'
			? raiseProof(intent.coverage?.proofLevel, RULES.machineProofCap)
			: s.verdict === 'partial'
				? 'heuristic'
				: intent.coverage?.proofLevel //  fail: how it's tested is unchanged; it's just failing now
	const health: Health | undefined =
		s.verdict === 'fail' ? 'down' : s.verdict === 'partial' ? 'partial' : intent.health
	return {
		...intent,
		...(health ? { health } : {}),
		coverage: { ...intent.coverage, passing, proofLevel, lastRun: s.generatedAt, evidenceRef: s.evidenceRef },
	}
}

export function applyCoverage(
	ledger: Ledger,
	signals: CoverageSignal[],
	opts: ApplyCoverageOptions = {},
): Ledger {
	if (!signals.length) {
		return ledger
	}
	const precedence = opts.precedence ?? []
	const rank = (producer: string) => {
		const i = precedence.indexOf(producer)
		return i === -1 ? precedence.length : i
	}
	// Pick the most authoritative signal among candidates for one target.
	const best = (cands: CoverageSignal[]): CoverageSignal | undefined =>
		cands.reduce<CoverageSignal | undefined>(
			(acc, s) => (!acc || rank(s.producer) < rank(acc.producer) ? s : acc),
			undefined,
		)

	const byLane = new Map<string, CoverageSignal[]>()
	const byIntentId = new Map<string, CoverageSignal[]>()
	for (const s of signals) {
		if (s.key.lane) push(byLane, s.key.lane, s)
		if (s.key.intentId) push(byIntentId, s.key.intentId, s)
	}
	const overlayIntent = (i: UserIntent): UserIntent => {
		const candidates = [...(i.lane ? byLane.get(i.lane) ?? [] : []), ...(byIntentId.get(i.id) ?? [])]
		const s = best(candidates)
		return s ? applyVerdict(i, s) : i
	}
	return {
		...ledger,
		features: ledger.features.map((f) =>
			f.intents ? { ...f, intents: f.intents.map(overlayIntent) } : f,
		),
	}
}
