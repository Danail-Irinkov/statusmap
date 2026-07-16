<template>
	<span
		class="status-map-badge"
		:class="{ 'status-map-badge--mono': badge.mono, 'status-map-badge--pulse': badge.pulse }"
		:style="vars"
		:data-tone="badge.tone"
		data-testid="status-map-badge">
		<span class="status-map-badge__dot" aria-hidden="true"></span>
		<span class="status-map-badge__label">{{ badge.label }}</span>
	</span>
</template>

<script setup lang="ts">
// Status atom — a tinted live-status pill (header/meta). Tint flows from statusTone(); the dot pulses for
// live signals. No status color is hard-coded here.
import { computed } from 'vue'
import { statusToneVars, type StatusBadge } from '@statusmap/core'

defineOptions({ name: 'StatusMapBadge' })
const props = defineProps<{ badge: StatusBadge }>()
const vars = computed(() => statusToneVars(props.badge.tone))
</script>

<style scoped>
.status-map-badge {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 3px 9px;
	border-radius: 999px;
	border: 1px solid var(--tone-border);
	background: var(--tone-bg);
	color: var(--tone-fg);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.01em;
	line-height: 1.3;
	white-space: nowrap;
}

.status-map-badge--mono {
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-weight: 600;
	letter-spacing: 0;
}

.status-map-badge__dot {
	flex: none;
	width: 7px;
	height: 7px;
	border-radius: 999px;
	background: var(--tone-dot);
}

.status-map-badge--pulse .status-map-badge__dot {
	animation: status-map-badge-pulse 1.6s ease-in-out infinite;
}

@keyframes status-map-badge-pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.3;
	}
}

@media (prefers-reduced-motion: reduce) {
	.status-map-badge--pulse .status-map-badge__dot {
		animation: none;
	}
}
</style>
