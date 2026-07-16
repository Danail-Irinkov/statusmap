<template>
	<article class="status-map-page">
		<header class="status-map-page__masthead">
			<!-- Lead slot: renders at the top of the masthead, directly above the title. The explorer fills it
			     with the breadcrumb trail (+ its top-right controls). Standalone consumers fall back to the
			     generated eyebrow, so module-authored definitions are unchanged. -->
			<slot name="lead">
				<p
					v-if="meta.eyebrow"
					class="status-map-page__eyebrow">{{ meta.eyebrow }}</p>
			</slot>
			<h1 class="status-map-page__title">{{ meta.title }}</h1>
			<p
				v-if="meta.subtitle"
				class="status-map-page__subtitle">{{ meta.subtitle }}</p>
			<div
				v-if="meta.badges?.length"
				class="status-map-page__badges">
				<StatusMapBadge
					v-for="(badge, i) in meta.badges"
					:key="`mb-${i}`"
					:badge="badge" />
			</div>
			<p
				v-if="snapshot"
				class="status-map-page__snapshot">{{ snapshot }}</p>
		</header>

		<!-- Toolbar slot: renders between the masthead and the sections. The explorer puts the review-filter
		     chips (and the flat-view jump nav) here so they sit just below the title/badges. -->
		<slot name="toolbar" />

		<template
			v-for="(section, i) in definition.sections"
			:key="section.id || `${section.kind}-${i}`">
			<component
				:is="registry[section.kind]"
				v-if="registry[section.kind]"
				:section="section" />
			<StatusMapShell
				v-else
				kind="unrendered"
				:title="`Unrendered section: ${section.kind}`" />
		</template>
	</article>
</template>

<script setup lang="ts">
// The one renderer. Props { definition }. Renders the meta masthead, then iterates definition.sections
// through a kind → component registry, and owns/provides the legend filter. No map content lives here; a
// definition comes from a hand-authored module or a @statusmap/core generator. Section kinds not yet in the
// registry render a labelled placeholder rather than crashing (incremental build; extend the registry).
import { computed, provide, type Component } from 'vue'
import type { StatusMapDefinition, StatusMapSectionKind } from '@statusmap/core'
import { STATUS_MAP_FILTER, createStatusMapFilter } from './filter'
import StatusMapBadge from './StatusMapBadge.vue'
import StatusMapShell from './StatusMapShell.vue'
import StatusMapHeader from './StatusMapHeader.vue'
import StatusMapLegend from './StatusMapLegend.vue'
import StatusMapFlow from './StatusMapFlow.vue'
import StatusMapCards from './StatusMapCards.vue'
import StatusMapLadder from './StatusMapLadder.vue'
import StatusMapMatrix from './StatusMapMatrix.vue'
import StatusMapTimeline from './StatusMapTimeline.vue'
import StatusMapPanel from './StatusMapPanel.vue'

defineOptions({ name: 'StatusMapPage' })
const props = defineProps<{ definition: StatusMapDefinition }>()

const meta = computed(() => props.definition.meta)

const registry: Record<StatusMapSectionKind, Component> = {
	header: StatusMapHeader,
	legend: StatusMapLegend,
	flow: StatusMapFlow,
	cards: StatusMapCards,
	ladder: StatusMapLadder,
	matrix: StatusMapMatrix,
	timeline: StatusMapTimeline,
	panel: StatusMapPanel,
}

// The page is the only owner of interactivity — it provides the legend filter the sections inject.
provide(STATUS_MAP_FILTER, createStatusMapFilter())

// Deterministic, locale-free snapshot line (internal tool): trim the ISO to minutes.
function fmt(iso?: string) {
	if (!iso) {
		return ''
	}
	const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso)
	return m ? `${m[1]} ${m[2]}Z` : iso
}
const snapshot = computed(() => {
	const parts: string[] = []
	if (meta.value.generatedAt) {
		parts.push(`Snapshot ${fmt(meta.value.generatedAt)}`)
	}
	if (meta.value.sourceGeneratedAt && meta.value.sourceGeneratedAt !== meta.value.generatedAt) {
		parts.push(`source ${fmt(meta.value.sourceGeneratedAt)}`)
	}
	return parts.join(' · ')
})
</script>

<style scoped>
.status-map-page {
	background: var(--statusmap-page, #ffffff);
	color: var(--statusmap-text, #0f172a);
}

.status-map-page__masthead {
	max-width: 60rem;
	margin-inline: auto;
	padding: 1.75rem 20px 1.25rem;
}

.status-map-page__eyebrow {
	margin: 0 0 4px;
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--statusmap-muted, #64748b);
}

.status-map-page__title {
	margin: 0;
	font-family: var(--statusmap-font-display, ui-sans-serif, system-ui, sans-serif);
	font-size: clamp(1.6rem, 4vw, 2.1rem);
	font-weight: 600;
	letter-spacing: -0.015em;
}

.status-map-page__subtitle {
	margin: 6px 0 0;
	font-size: 14px;
	line-height: 1.5;
	color: var(--statusmap-muted, #64748b);
	max-width: 46rem;
}

.status-map-page__badges {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 12px;
}

.status-map-page__snapshot {
	margin: 12px 0 0;
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-size: 11px;
	color: var(--statusmap-muted, #64748b);
}

@media (min-width: 768px) {
	.status-map-page__masthead {
		padding-inline: 28px;
	}
}
</style>
