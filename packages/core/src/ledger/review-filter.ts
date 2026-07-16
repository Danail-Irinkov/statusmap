// BACK-COMPAT SHIM (PRD §6.6 / D-006 / G4). The review filter has been generalized into the unified,
// framework-neutral `StatusMapFilterState` + `filterLedger` in `./filter.ts` (four composable dimensions:
// tones, verdicts, areas, text). This module re-exports those under their ORIGINAL names so every existing
// importer (StatusMapExplorer.vue and the existing tests) compiles and runs unchanged — purely
// additive, no breaking change. Prefer importing from `./filter` (or `@statusmap/core`) in new code.

import type { StatusMapFilterState } from './filter'
import { filterSummary, isFilterActive } from './filter'
import type { Ledger } from './types'

// Re-export the generalized predicate + vocab under their original names.
export {
	filterLedger,
	intentVerdictCategories,
	NEEDS_ATTENTION_TONES,
	REVIEW_VERDICTS,
	type VerdictCategory,
} from './filter'

/**
 * @deprecated Use {@link StatusMapFilterState}. Kept as an alias so pre-D-006 code that types a
 * `{ statuses, verdicts }` filter keeps compiling. The `statuses` key is still honored at runtime as the
 * tone axis (see `StatusMapFilterState.statuses`); new code should use `tones`.
 */
export type ReviewFilter = StatusMapFilterState

/** @deprecated Alias of `isFilterActive` (the unified predicate). */
export function isReviewFilterActive(filter: ReviewFilter): boolean {
	return isFilterActive(filter)
}

/** @deprecated Alias of `filterSummary` (the unified summary). */
export function reviewFilterSummary(
	ledger: Ledger,
	filter: ReviewFilter,
): { shown: number; total: number } {
	return filterSummary(ledger, filter)
}
