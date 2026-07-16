<template>
	<span
		class="status-map-chip"
		:class="{ 'status-map-chip--mono': chip.mono, 'status-map-chip--toned': !!chip.tone }"
		:style="vars"
		:title="chip.title || undefined"
		data-testid="status-map-chip">
		<span
			v-if="chip.tone"
			class="status-map-chip__dot"
			aria-hidden="true"></span>
		<span class="status-map-chip__label">{{ chip.label }}</span>
	</span>
</template>

<script setup lang="ts">
// Status atom — a small meta tag (scope / owner / lane). Toned chips carry a dot + tint; untoned chips are
// a quiet outlined label. `mono` for ids/paths; `title` for the hover hint. Tint via statusTone().
import { computed } from 'vue'
import { statusToneVars, type Chip } from '@statusmap/core'

defineOptions({ name: 'StatusMapChip' })
const props = defineProps<{ chip: Chip }>()
const vars = computed(() => (props.chip.tone ? statusToneVars(props.chip.tone) : {}))
</script>

<style scoped>
.status-map-chip {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 2px 8px;
	border-radius: 6px;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	background: var(--statusmap-card, #f8fafc);
	color: var(--statusmap-muted, #64748b);
	font-size: 11px;
	font-weight: 600;
	line-height: 1.35;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.status-map-chip--toned {
	border-color: var(--tone-border);
	background: var(--tone-bg);
	color: var(--tone-fg);
}

.status-map-chip--mono {
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-weight: 600;
}

.status-map-chip__dot {
	flex: none;
	width: 6px;
	height: 6px;
	border-radius: 999px;
	background: var(--tone-dot);
}

.status-map-chip__label {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
