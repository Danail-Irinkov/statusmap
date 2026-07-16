<template>
	<div class="status-explorer">
		<StatusMapPage
			v-if="definition"
			:key="definition.meta.id"
			:definition="definition">
			<!-- Lead: top-right controls (search in the first slot, then the view switcher) followed by the
			     breadcrumb trail, which sits directly on top of the page title. The app chrome renders its own
			     breadcrumb, so the masthead eyebrow is dropped here to avoid a third duplicate. -->
			<template #lead>
				<div class="status-explorer__controls">
					<input
						type="search"
						class="status-explorer__search"
						:value="searchText"
						placeholder="Search status map…"
						aria-label="Filter the map by text"
						@input="onSearchInput(($event.target as HTMLInputElement).value)" />
					<div
						class="status-explorer__views"
						role="group"
						aria-label="View">
						<component
							:is="link.component"
							class="status-explorer__view"
							:class="{ 'status-explorer__view--active': !isFlat }"
							:aria-current="!isFlat ? 'page' : undefined"
							v-bind="linkProps(basePath)">
							Grouped
						</component>
						<component
							:is="link.component"
							class="status-explorer__view"
							:class="{ 'status-explorer__view--active': isFlat }"
							:aria-current="isFlat ? 'page' : undefined"
							v-bind="linkProps(flatHref)">
							List
						</component>
					</div>
				</div>
				<nav
					class="status-explorer__crumbs"
					aria-label="Breadcrumb">
					<component
						:is="link.component"
						class="status-explorer__crumb"
						v-bind="linkProps(basePath)">
						Status tree
					</component>
					<template v-if="!isFlat && currentArea">
						<span class="status-explorer__sep">›</span>
						<component
							:is="link.component"
							class="status-explorer__crumb"
							v-bind="linkProps(areaHref(currentArea.id))">
							{{ currentArea.label }}
						</component>
					</template>
					<template v-if="!isFlat && currentFeature">
						<span class="status-explorer__sep">›</span>
						<span class="status-explorer__crumb status-explorer__crumb--current">{{ currentFeature.label }}</span>
					</template>
					<template v-if="isFlat">
						<span class="status-explorer__sep">›</span>
						<span class="status-explorer__crumb status-explorer__crumb--current">List</span>
					</template>
				</nav>
			</template>

			<!-- Review filter: status × verdict chips, AND-combined, applied across the whole map. The free-text
			     typeahead now lives in the top-right controls; these chips sit just below the title/badges. The
			     flat-view jump nav rides along here too. -->
			<template #toolbar>
				<div
					class="status-explorer__filter"
					role="group"
					aria-label="Review filter">
					<button
						type="button"
						class="status-explorer__preset"
						:class="{ 'status-explorer__preset--on': needsAttentionOn }"
						:aria-pressed="needsAttentionOn"
						v-if="showNeedsAttention"
						@click="toggleNeedsAttention">
						Needs attention
					</button>
					<span class="status-explorer__chips">
						<button
							v-for="chip in visibleStatusChips"
							:key="chip.label"
							type="button"
							class="status-explorer__chip"
							:class="{ 'status-explorer__chip--on': statusChipActive(chip.tones) }"
							:aria-pressed="statusChipActive(chip.tones)"
							@click="toggleStatusChip(chip.tones)">
							{{ chip.label }}
						</button>
					</span>
					<span
						class="status-explorer__filter-sep"
						aria-hidden="true"
						v-if="(showNeedsAttention || visibleStatusChips.length) && visibleVerdicts.length">·</span>
					<span class="status-explorer__chips">
						<button
							v-for="v in visibleVerdicts"
							:key="v"
							type="button"
							class="status-explorer__chip status-explorer__chip--verdict"
							:class="{ 'status-explorer__chip--on': (review.verdicts || []).includes(v) }"
							:aria-pressed="(review.verdicts || []).includes(v)"
							@click="toggleVerdict(v)">
							{{ VERDICT_LABELS[v] }}
						</button>
					</span>
					<span
						v-if="filterActive"
						class="status-explorer__filter-status">
						{{ filterSummary.shown }} / {{ filterSummary.total }} {{ nounMany }}
						<button
							type="button"
							class="status-explorer__clear-filter"
							@click="clearReviewFilter">Clear</button>
					</span>
				</div>

				<nav
					v-if="isFlat && areaJumps.length"
					class="status-explorer__jump"
					aria-label="Jump to area">
					<a
						v-for="area in areaJumps"
						:key="area.id"
						class="status-explorer__jump-link"
						:href="`#area-${area.id}`">
						{{ area.label }}
					</a>
				</nav>
			</template>
		</StatusMapPage>

		<div
			v-else
			class="status-explorer__notice">
			<h1>{{ filteredOut ? 'No matches' : 'Not found' }}</h1>
			<p v-if="filteredOut">Nothing here matches the current filter.</p>
				<p v-else>No ledger entry for that id.</p>
				<button
					v-if="filteredOut"
					type="button"
					class="status-explorer__clear-filter"
					@click="clearReviewFilter">
					Clear filter
				</button>
			<component
				v-if="!filteredOut"
				:is="link.component"
				class="status-explorer__back"
				v-bind="linkProps(basePath)">
				← Back to the status tree
			</component>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
	filterLedger,
	isReviewFilterActive,
	ledgerToArea,
	ledgerToFeatureDetail,
	ledgerToFlat,
	ledgerToOverview,
	NEEDS_ATTENTION_TONES,
	REVIEW_VERDICTS,
	reviewFilterSummary,
	setText,
	type GeneratorOptions,
	type Ledger,
	type ReviewFilter,
	type StatusTone,
	type VerdictCategory,
} from '@statusmap/core'
import { useStatusMapLink } from './link'
import StatusMapPage from './StatusMapPage.vue'

defineOptions({ name: 'StatusMapExplorer' })

const props = withDefaults(
	defineProps<{
		ledger: Ledger
		area?: string
		feature?: string
		view?: 'explore' | 'flat'
		basePath?: string
		brand?: string
		featureNoun?: { one: string; many: string }
	}>(),
	{
		area: '',
		feature: '',
		view: 'explore',
		basePath: '/status-map',
		brand: undefined,
		featureNoun: undefined,
	},
)

const link = useStatusMapLink()

// Review filter — local reactive state (status × verdict, AND-combined). It prunes the ledger every view
// generates from, so overview / area / feature / flat all reflect it.
const review = ref<ReviewFilter>({ statuses: [], verdicts: [] })
const STATUS_CHIPS: { label: string; tones: StatusTone[] }[] = [
	{ label: 'Beta-test ready', tones: ['beta'] },
	{ label: 'Built / partial', tones: ['yellow'] },
	{ label: 'Down', tones: ['red', 'blocked'] },
	{ label: 'Deferred', tones: ['stale'] },
	{ label: 'Not built', tones: ['planned', 'unknown'] },
]
const VERDICT_LABELS: Record<VerdictCategory, string> = {
	proven: 'Proven',
	heuristic: 'Heuristic',
	failing: 'Failing',
	untested: 'Untested',
	blocked: 'Blocked',
	not_built: 'Not built',
}
const filterActive = computed(() => isReviewFilterActive(review.value))
const filterSummary = computed(() => reviewFilterSummary(props.ledger, review.value))
const needsAttentionOn = computed(() =>
	NEEDS_ATTENTION_TONES.every((t) => (review.value.statuses ?? []).includes(t)),
)
// Minimum-needed chips: only show a status/verdict bubble if selecting it would actually match a node in the
// FULL ledger. filterLedger is the same matcher the chips drive, so a shown chip can never empty the map, and
// statuses absent from the data (e.g. nothing is "Down") never render a dead bubble.
const visibleStatusChips = computed(() =>
	STATUS_CHIPS.filter((c) => filterLedger(props.ledger, { statuses: c.tones }).features.length > 0),
)
const visibleVerdicts = computed(() =>
	REVIEW_VERDICTS.filter(
		(v) => v !== 'not_built' && filterLedger(props.ledger, { verdicts: [v] }).features.length > 0,
	),
)
const showNeedsAttention = computed(
	() => filterLedger(props.ledger, { statuses: NEEDS_ATTENTION_TONES }).features.length > 0,
)
function statusChipActive(tones: StatusTone[]) {
	const set = review.value.statuses ?? []
	return tones.every((t) => set.includes(t))
}
function toggleStatusChip(tones: StatusTone[]) {
	const set = new Set(review.value.statuses ?? [])
	const allOn = tones.every((t) => set.has(t))
	for (const t of tones) {
		if (allOn) set.delete(t)
		else set.add(t)
	}
	review.value = { ...review.value, statuses: [...set] }
}
function toggleVerdict(v: VerdictCategory) {
	const set = new Set(review.value.verdicts ?? [])
	if (set.has(v)) set.delete(v)
	else set.add(v)
	review.value = { ...review.value, verdicts: [...set] }
}
function toggleNeedsAttention() {
	review.value = {
		...review.value,
		statuses: needsAttentionOn.value ? [] : [...NEEDS_ATTENTION_TONES],
	}
}
function clearReviewFilter() {
	if (searchTimer) clearTimeout(searchTimer)
	searchText.value = ''
	review.value = { statuses: [], verdicts: [] }
}

// Free-text typeahead (PRD §6.6 `text` dimension). `searchText` is the immediate input model (so typing
// stays snappy); a short debounce commits it into the filter state, which `filterLedger` already honours by
// case-insensitive substring over each node's label + summary/note + workflow labels. Blank clears the
// dimension (setText canonicalises that), so an empty box restores the full map.
const searchText = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearchInput(value: string) {
	searchText.value = value
	if (searchTimer) clearTimeout(searchTimer)
	searchTimer = setTimeout(() => {
		review.value = setText(review.value, value)
	}, 200)
}
onBeforeUnmount(() => {
	if (searchTimer) clearTimeout(searchTimer)
})
const filteredLedger = computed(() => filterLedger(props.ledger, review.value))

const isFlat = computed(() => props.view === 'flat')
const flatHref = computed(() => `${props.basePath}?view=flat`)

const currentFeature = computed(() => props.ledger.features.find((feature) => feature.id === props.feature) || null)
const currentArea = computed(() => {
	const areaId = props.area || currentFeature.value?.areaId || ''
	return props.ledger.areas.find((area) => area.id === areaId) || null
})
// A filter can empty the whole map or only the currently drilled area/feature. Both are genuine empty
// results; reserve "Not found" for ids that never existed in the unfiltered ledger.
const filteredOut = computed(() => {
	if (!filterActive.value) return false
	const features = filteredLedger.value.features
	if (features.length === 0) return true
	if (isFlat.value) return false
	if (currentFeature.value && !features.some((feature) => feature.id === currentFeature.value?.id)) return true
	if (currentArea.value && !features.some((feature) => feature.areaId === currentArea.value?.id)) return true
	return false
})

const areaJumps = computed(() =>
	[...props.ledger.areas].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
)

const nounMany = computed(() => props.featureNoun?.many ?? 'features')
const generatorOptions = computed<GeneratorOptions>(() => ({
	basePath: props.basePath,
	brand: props.brand,
	featureNoun: props.featureNoun,
}))

const definition = computed(() => {
	const led = filteredLedger.value
	if (filteredOut.value) return null
	if (isFlat.value) {
		return ledgerToFlat(led, generatorOptions.value)
	}
	if (props.feature) {
		return ledgerToFeatureDetail(led, props.feature, generatorOptions.value)
	}
	if (props.area) {
		return ledgerToArea(led, props.area, generatorOptions.value)
	}
	return ledgerToOverview(led, generatorOptions.value)
})

function linkProps(to?: string) {
	return to ? { [link.prop]: to } : {}
}

function areaHref(areaId: string) {
	return `${props.basePath}?area=${encodeURIComponent(areaId)}`
}
</script>

<style scoped>
.status-explorer {
	min-height: 100vh;
	background: var(--statusmap-page, #ffffff);
	color: var(--statusmap-text, #0f172a);
	padding-bottom: 3rem;
}

/* Controls live inside the masthead (#lead slot), so they inherit the masthead's centred 60rem column
   and padding. Search sits at the left edge, the view switcher at the right edge. */
.status-explorer__controls {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 12px;
}

.status-explorer__controls .status-explorer__search {
	width: clamp(12rem, 38vw, 20rem);
}

.status-explorer__crumbs {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px; /* sit directly on top of the title */
	font-size: 12px;
}

.status-explorer__views {
	display: inline-flex;
	flex: none;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-radius: 999px;
	overflow: hidden;
	background: var(--statusmap-card, #f8fafc);
}

.status-explorer__view {
	padding: 5px 13px;
	font-size: 12px;
	font-weight: 700;
	color: var(--statusmap-muted, #64748b);
	text-decoration: none;
	white-space: nowrap;
	transition: background 0.12s ease, color 0.12s ease;
}

.status-explorer__view + .status-explorer__view {
	border-left: 1px solid var(--statusmap-border, #e2e8f0);
}

.status-explorer__view:hover {
	background: var(--statusmap-page, #ffffff);
}

.status-explorer__view--active,
.status-explorer__view--active:hover {
	background: var(--statusmap-link, #0f766e);
	color: var(--statusmap-page, #ffffff);
}

.status-explorer__jump-link:focus-visible,
.status-explorer__crumb:focus-visible,
.status-explorer__preset:focus-visible,
.status-explorer__chip:focus-visible,
.status-explorer__clear-filter:focus-visible,
.status-explorer__back:focus-visible {
	outline: 2px solid var(--statusmap-link, #0f766e);
	outline-offset: 2px;
}

.status-explorer__view:focus-visible {
	outline: none;
	box-shadow: inset 0 0 0 2px var(--statusmap-link, #0f766e);
}

.status-explorer__view--active:focus-visible {
	box-shadow: inset 0 0 0 2px var(--statusmap-page, #ffffff);
}

.status-explorer__jump {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	max-width: 60rem;
	margin-inline: auto;
	padding: 12px 20px 0;
}

.status-explorer__jump-link {
	padding: 3px 10px;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-radius: 999px;
	background: var(--statusmap-card, #f8fafc);
	color: var(--statusmap-link, #0f766e);
	font-size: 11px;
	font-weight: 600;
	text-decoration: none;
	white-space: nowrap;
}

.status-explorer__jump-link:hover {
	background: var(--statusmap-page, #ffffff);
	text-decoration: underline;
}

.status-explorer__crumb {
	color: var(--statusmap-link, #0f766e);
	font-weight: 600;
	text-decoration: none;
}

.status-explorer__crumb:hover {
	text-decoration: underline;
}

.status-explorer__crumb--current {
	color: var(--statusmap-muted, #64748b);
	font-weight: 700;
}

.status-explorer__sep {
	color: var(--statusmap-muted, #64748b);
}

.status-explorer__notice {
	max-width: 40rem;
	margin-inline: auto;
	padding: 80px 20px;
	text-align: center;
	color: var(--statusmap-muted, #64748b);
}

.status-explorer__notice h1 {
	font-family: var(--statusmap-font-display, ui-sans-serif, system-ui, sans-serif);
	font-size: 1.6rem;
	margin: 0 0 8px;
	color: var(--statusmap-text, #0f172a);
}

/* Review filter bar */
.status-explorer__filter {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	max-width: 60rem;
	margin-inline: auto;
	padding: 12px 20px 0;
}

.status-explorer__search {
	width: 100%;
	max-width: 22rem;
	padding: 6px 13px;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-radius: 999px;
	background: var(--statusmap-card, #f8fafc);
	color: var(--statusmap-text, #0f172a);
	font: inherit;
	font-size: 13px;
}

.status-explorer__search::placeholder {
	color: var(--statusmap-muted, #64748b);
}

.status-explorer__search:focus-visible {
	outline: 2px solid var(--statusmap-link, #0f766e);
	outline-offset: 1px;
	border-color: var(--statusmap-link, #0f766e);
}

.status-explorer__chips {
	display: inline-flex;
	flex-wrap: wrap;
	gap: 6px;
}

.status-explorer__preset,
.status-explorer__chip {
	font: inherit;
	padding: 4px 11px;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-radius: 999px;
	background: var(--statusmap-card, #f8fafc);
	color: var(--statusmap-muted, #64748b);
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
	white-space: nowrap;
}

.status-explorer__preset {
	font-weight: 700;
	color: var(--statusmap-text, #0f172a);
}

.status-explorer__preset--on,
.status-explorer__chip--on {
	border-color: var(--statusmap-link, #0f766e);
	background: var(--statusmap-link, #0f766e);
	color: var(--statusmap-page, #ffffff);
}

.status-explorer__filter-sep {
	color: var(--statusmap-border-strong, #cbd5e1);
}

.status-explorer__filter-status {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	margin-left: auto;
	font-size: 12px;
	font-weight: 600;
	color: var(--statusmap-muted, #64748b);
}

@media (prefers-reduced-motion: reduce) {
	.status-explorer__view {
		transition: none;
	}
}

.status-explorer__clear-filter {
	font: inherit;
	padding: 3px 9px;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-radius: 8px;
	background: transparent;
	color: var(--statusmap-link, #0f766e);
	font-size: 11px;
	font-weight: 700;
	cursor: pointer;
}
</style>
