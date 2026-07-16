<template>
	<StatusMapShell
		kind="timeline"
		:num="section.num"
		:title="section.title"
		:subtitle="section.subtitle"
		:tone="section.tone"
		:anchor-id="section.id">
		<ol class="status-map-timeline">
			<li
				v-for="(step, i) in section.steps"
				:key="`step-${i}`"
				class="status-map-timeline__step"
				:class="{ 'status-map-timeline__step--current': step.current }">
				<span
					class="status-map-timeline__marker"
					aria-hidden="true"></span>
				<div class="status-map-timeline__content">
					<p class="status-map-timeline__head">
						<span
							v-if="step.rank"
							class="status-map-timeline__rank">{{ step.rank }}</span>
						<span class="status-map-timeline__title">{{ step.title }}</span>
						<StatusMapChip
							v-if="step.tag"
							:chip="{ label: step.tag.label, tone: step.tag.tone }" />
					</p>
					<p
						v-if="step.body"
						class="status-map-timeline__body">{{ step.body }}</p>
				</div>
			</li>
		</ol>
	</StatusMapShell>
</template>

<script setup lang="ts">
// Section: ranked/sequenced steps (roadmap, rollout). A vertical spine with a marker per step; the
// `current` step is emphasized; each step can carry a toned tag chip. Reads top-to-bottom with no JS.
import type { TimelineSection } from '@statusmap/core'
import StatusMapShell from './StatusMapShell.vue'
import StatusMapChip from './StatusMapChip.vue'

defineOptions({ name: 'StatusMapTimeline' })
defineProps<{ section: TimelineSection }>()
</script>

<style scoped>
.status-map-timeline {
	display: flex;
	flex-direction: column;
	gap: 0;
	margin: 0;
	padding: 0 0 0 6px;
	list-style: none;
}

.status-map-timeline__step {
	position: relative;
	display: grid;
	grid-template-columns: auto 1fr;
	gap: 12px;
	padding-bottom: 14px;
}

.status-map-timeline__step:not(:last-child)::before {
	content: '';
	position: absolute;
	left: 5px;
	top: 14px;
	bottom: 0;
	width: 2px;
	background: var(--statusmap-border, #e2e8f0);
}

.status-map-timeline__marker {
	position: relative;
	z-index: 1;
	margin-top: 4px;
	width: 12px;
	height: 12px;
	border-radius: 999px;
	border: 2px solid var(--statusmap-border-strong, #cbd5e1);
	background: var(--statusmap-page, #ffffff);
}

.status-map-timeline__step--current .status-map-timeline__marker {
	border-color: var(--statusmap-active-border, #93c5fd);
	background: var(--statusmap-active-dot, #2563eb);
}

.status-map-timeline__head {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin: 0;
}

.status-map-timeline__rank {
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-size: 11px;
	font-weight: 700;
	color: var(--statusmap-muted, #64748b);
}

.status-map-timeline__title {
	font-size: 13px;
	font-weight: 700;
	color: var(--statusmap-text, #0f172a);
}

.status-map-timeline__step--current .status-map-timeline__title {
	color: var(--statusmap-active-fg, #1e40af);
}

.status-map-timeline__body {
	margin: 4px 0 0;
	font-size: 12px;
	line-height: 1.5;
	color: var(--statusmap-muted, #64748b);
}
</style>
