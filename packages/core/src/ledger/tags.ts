// Tags — free-form labels (e.g. 'sanity', 'smoke') a map can be filtered by. The library knows nothing about
// what a tag MEANS; it only unions and matches them.
//
// A node's tags come from two places:
//   • authored — `tags: [sanity]` on an area / feature / intent / workflow (YAML, or injected into the parsed
//     ledger objects before you hand them to a renderer);
//   • test-derived — `tags` on a report suite or spec (Playwright reports carry them on specs natively),
//     merged into the intent/workflow whose owningE2e/matrix matches that suite or spec (see
//     `applyCoverageTests`).
//
// A node's EFFECTIVE tag set is its own tags ∪ every descendant's, so a feature carries 'sanity' if any
// intent under it does. Every function here is pure and returns a fresh array.

import type { Ledger, LedgerArea, LedgerFeature, UserIntent, Workflow } from './types'

// 'sanity' and Playwright's '@sanity' are the same tag. Blank / non-string values are dropped.
export function normalizeTag(tag: unknown): string {
	return typeof tag === 'string' ? tag.trim().replace(/^@+/, '').trim() : ''
}

// Normalize + de-dupe (first-seen order). Accepts anything so a hand-written `tags: sanity` scalar or a
// malformed value degrades to "no tags" rather than throwing at render time.
export function normalizeTags(tags: unknown): string[] {
	const list = Array.isArray(tags) ? tags : []
	return [...new Set(list.map(normalizeTag).filter(Boolean))]
}

export function mergeTags(...lists: Array<readonly unknown[] | undefined>): string[] {
	return normalizeTags(lists.flatMap((l) => l ?? []))
}

export function workflowTags(w: Workflow): string[] {
	return normalizeTags(w.tags)
}

export function intentTags(i: UserIntent): string[] {
	return mergeTags(i.tags, ...(i.workflows || []).map(workflowTags))
}

export function featureTags(f: LedgerFeature): string[] {
	return mergeTags(f.tags, ...(f.intents || []).map(intentTags))
}

export function areaTags(ledger: Ledger, area: LedgerArea): string[] {
	return mergeTags(
		area.tags,
		...ledger.features.filter((f) => f.areaId === area.id).map(featureTags),
	)
}

// Every distinct tag in the ledger, sorted — what the tag filter renders one chip per.
export function collectLedgerTags(ledger: Ledger): string[] {
	return mergeTags(
		...ledger.areas.map((a) => a.tags),
		...ledger.features.map(featureTags),
	).sort((a, b) => a.localeCompare(b))
}
