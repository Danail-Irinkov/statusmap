<template>
	<StatusMapShell
		kind="header"
		:num="section.num"
		:title="section.title"
		:subtitle="section.subtitle"
		:tone="section.tone"
		:anchor-id="section.id">
		<div class="status-map-header">
			<div
				v-if="section.badges?.length"
				class="status-map-header__row">
				<StatusMapBadge
					v-for="(badge, i) in section.badges"
					:key="`b-${i}`"
					:badge="badge" />
			</div>
			<div
				v-if="section.chips?.length"
				class="status-map-header__row">
				<StatusMapChip
					v-for="(chip, i) in section.chips"
					:key="`c-${i}`"
					:chip="chip" />
			</div>
			<p
				v-if="section.note"
				class="status-map-header__note">{{ section.note }}</p>
		</div>
	</StatusMapShell>
</template>

<script setup lang="ts">
// Section: in-flow header block — a badge row, a chip row, and a note. (The page masthead is rendered
// separately from `meta`; this is for secondary headers / area bands inside the flow.)
import type { HeaderSection } from '@statusmap/core'
import StatusMapShell from './StatusMapShell.vue'
import StatusMapBadge from './StatusMapBadge.vue'
import StatusMapChip from './StatusMapChip.vue'

defineOptions({ name: 'StatusMapHeader' })
defineProps<{ section: HeaderSection }>()
</script>

<style scoped>
.status-map-header {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.status-map-header__row {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.status-map-header__note {
	margin: 0;
	font-size: 13px;
	line-height: 1.5;
	color: var(--statusmap-muted, #64748b);
}
</style>
