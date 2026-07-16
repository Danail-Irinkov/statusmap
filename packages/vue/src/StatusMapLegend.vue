<template>
	<StatusMapShell
		kind="legend"
		tone="card"
		:num="section.num"
		:title="section.title"
		:subtitle="section.subtitle"
		:anchor-id="section.id">
		<ul class="status-map-legend">
			<li
				v-for="(item, i) in section.items"
				:key="`l-${i}`"
				class="status-map-legend__item">
				<!-- Filterable legends render real buttons (enhancement); non-filter legends are static
				     <span>s so the map still reads the legend with JS disabled. -->
				<component
					:is="section.filters ? 'button' : 'span'"
					class="status-map-legend__hit"
					:class="{ 'status-map-legend__hit--active': section.filters && filter.isActive(item.tone) }"
					:type="section.filters ? 'button' : undefined"
					:aria-pressed="section.filters ? String(filter.isActive(item.tone)) : undefined"
					:style="vars(item.tone)"
					@click="onItem(item)">
					<span
						class="status-map-legend__dot"
						aria-hidden="true"></span>
					<span class="status-map-legend__label">{{ item.label }}</span>
					<span
						v-if="item.hint"
						class="status-map-legend__hint">{{ item.hint }}</span>
				</component>
			</li>
		</ul>
		<button
			v-if="section.filters && filter.anyActive.value"
			type="button"
			class="status-map-legend__clear"
			@click="filter.clear()">
			Clear filter
		</button>
	</StatusMapShell>
</template>

<script setup lang="ts">
// Section: the status legend. When `filters`, each entry toggles the page-level tone filter that
// StatusMapCards honors. Pure progressive enhancement — with JS off the legend is a static key and every
// card stays visible.
import { statusToneVars, type LegendItem, type LegendSection, type StatusTone } from '@statusmap/core'
import { useStatusMapFilter } from './filter'
import StatusMapShell from './StatusMapShell.vue'

defineOptions({ name: 'StatusMapLegend' })
const props = defineProps<{ section: LegendSection }>()

const filter = useStatusMapFilter()
const vars = (tone: StatusTone) => statusToneVars(tone)
const onItem = (item: LegendItem) => {
	if (props.section.filters) {
		filter.toggle(item.tone)
	}
}
</script>

<style scoped>
.status-map-legend {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.status-map-legend__item {
	display: flex;
}

.status-map-legend__hit {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	padding: 5px 11px;
	border-radius: 999px;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	background: var(--statusmap-card, #f8fafc);
	color: var(--statusmap-text, #0f172a);
	font: inherit;
	font-size: 12px;
	font-weight: 600;
	text-align: left;
	cursor: default;
}

button.status-map-legend__hit {
	cursor: pointer;
}

.status-map-legend__hit--active {
	border-color: var(--tone-border);
	background: var(--tone-bg);
	color: var(--tone-fg);
}

.status-map-legend__dot {
	flex: none;
	width: 9px;
	height: 9px;
	border-radius: 999px;
	background: var(--tone-dot);
}

.status-map-legend__hint {
	color: var(--statusmap-muted, #64748b);
	font-weight: 500;
}

.status-map-legend__hit--active .status-map-legend__hint {
	color: inherit;
}

.status-map-legend__clear {
	margin-top: 10px;
	padding: 4px 10px;
	border-radius: 8px;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	background: transparent;
	color: var(--statusmap-muted, #64748b);
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
}
</style>
