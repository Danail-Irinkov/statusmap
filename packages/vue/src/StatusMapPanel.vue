<template>
	<StatusMapShell
		kind="panel"
		:num="section.num"
		:title="section.title"
		:subtitle="section.subtitle"
		:anchor-id="section.id">
		<div
			class="status-map-panel"
			:style="vars(section.tone)"
			:class="{ 'status-map-panel--toned': !!section.tone }">
			<p
				v-if="section.body"
				class="status-map-panel__body">{{ section.body }}</p>
			<ul
				v-if="section.bullets?.length"
				class="status-map-panel__bullets">
				<li
					v-for="(b, i) in section.bullets"
					:key="`b-${i}`">{{ b }}</li>
			</ul>
			<div
				v-if="section.chips?.length"
				class="status-map-panel__chips">
				<StatusMapChip
					v-for="(chip, i) in section.chips"
					:key="`c-${i}`"
					:chip="chip" />
			</div>
		</div>
	</StatusMapShell>
</template>

<script setup lang="ts">
// Section: an emphasis block (a callout, a security/scope note). A tinted left border by tone, a body,
// bullets, and chips. Used for the prose-y callouts a map needs to foreground.
import { statusToneVars, type PanelSection, type StatusTone } from '@statusmap/core'
import StatusMapShell from './StatusMapShell.vue'
import StatusMapChip from './StatusMapChip.vue'

defineOptions({ name: 'StatusMapPanel' })
defineProps<{ section: PanelSection }>()
const vars = (tone?: StatusTone) => (tone ? statusToneVars(tone) : {})
</script>

<style scoped>
.status-map-panel {
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-left: 4px solid var(--statusmap-border-strong, #cbd5e1);
	border-radius: 10px;
	background: var(--statusmap-card, #f8fafc);
	padding: 14px 16px;
}

.status-map-panel--toned {
	border-left-color: var(--tone-border);
	background: var(--tone-bg);
}

.status-map-panel__body {
	margin: 0;
	font-size: 13px;
	line-height: 1.55;
	color: var(--statusmap-text, #0f172a);
}

.status-map-panel--toned .status-map-panel__body {
	color: var(--tone-fg);
}

.status-map-panel__bullets {
	margin: 10px 0 0;
	padding-left: 18px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 12px;
	line-height: 1.5;
	color: var(--statusmap-muted, #64748b);
}

.status-map-panel--toned .status-map-panel__bullets {
	color: var(--tone-fg);
}

.status-map-panel__chips {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 10px;
}
</style>
