<template>
	<StatusMapShell
		kind="ladder"
		:num="section.num"
		:title="section.title"
		:subtitle="section.subtitle"
		:tone="section.tone"
		:anchor-id="section.id">
		<ol class="status-map-ladder">
			<li
				v-for="(rung, i) in section.rungs"
				:key="`rung-${i}`"
				class="status-map-ladder__rung"
				:style="vars(rung.tone)"
				:class="{ 'status-map-ladder__rung--toned': !!rung.tone }">
				<span class="status-map-ladder__step">{{ i + 1 }}</span>
				<span class="status-map-ladder__label">{{ rung.label }}</span>
				<span
					v-if="rung.detail"
					class="status-map-ladder__detail">{{ rung.detail }}</span>
			</li>
		</ol>
	</StatusMapShell>
</template>

<script setup lang="ts">
// Section: ordered rungs (scope ladder, value ladder). Rungs flow as a wrapping row; each carries a
// top-border tone. Numbered so the order reads with JS disabled.
import { statusToneVars, type LadderSection, type StatusTone } from '@statusmap/core'
import StatusMapShell from './StatusMapShell.vue'

defineOptions({ name: 'StatusMapLadder' })
defineProps<{ section: LadderSection }>()
const vars = (tone?: StatusTone) => (tone ? statusToneVars(tone) : {})
</script>

<style scoped>
.status-map-ladder {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.status-map-ladder__rung {
	flex: 1 1 160px;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 3px;
	padding: 10px 12px;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-top: 3px solid var(--statusmap-border-strong, #cbd5e1);
	border-radius: 10px;
	background: var(--statusmap-card, #f8fafc);
}

.status-map-ladder__rung--toned {
	border-top-color: var(--tone-border);
}

.status-map-ladder__step {
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-size: 11px;
	font-weight: 700;
	color: var(--statusmap-muted, #64748b);
}

.status-map-ladder__label {
	font-size: 13px;
	font-weight: 700;
	color: var(--statusmap-text, #0f172a);
}

.status-map-ladder__detail {
	font-size: 12px;
	line-height: 1.45;
	color: var(--statusmap-muted, #64748b);
}
</style>
