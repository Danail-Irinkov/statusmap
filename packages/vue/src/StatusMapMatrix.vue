<template>
	<StatusMapShell
		kind="matrix"
		:num="section.num"
		:title="section.title"
		:subtitle="section.subtitle"
		:tone="section.tone"
		:anchor-id="section.id">
		<!-- Horizontal scroll is contained to the matrix wrapper (data), never the page. -->
		<div class="status-map-matrix__wrap">
			<table class="status-map-matrix">
				<thead>
					<tr>
						<th
							scope="col"
							class="status-map-matrix__corner">{{ section.columns[0] }}</th>
						<th
							v-for="(col, ci) in section.columns.slice(1)"
							:key="`col-${ci}`"
							scope="col">{{ col }}</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="(row, ri) in section.rows"
						:key="`row-${ri}`">
						<th
							scope="row"
							class="status-map-matrix__rowhead">{{ row.label }}</th>
						<td
							v-for="(cell, ci) in row.cells"
							:key="`cell-${ri}-${ci}`"
							class="status-map-matrix__cell"
							:style="vars(cell.tone)"
							:title="cell.note || undefined">
							{{ cell.text }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</StatusMapShell>
</template>

<script setup lang="ts">
// Section: a rows × columns matrix (feature × dimension, built-vs-tracked drift). Each cell is tinted by
// statusTone(cell.tone). Header + first column stick; horizontal overflow is the wrapper's, not the page's.
import { statusToneVars, type MatrixSection, type StatusTone } from '@statusmap/core'
import StatusMapShell from './StatusMapShell.vue'

defineOptions({ name: 'StatusMapMatrix' })
defineProps<{ section: MatrixSection }>()
const vars = (tone: StatusTone) => statusToneVars(tone)
</script>

<style scoped>
.status-map-matrix__wrap {
	overflow-x: auto;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-radius: 10px;
}

.status-map-matrix {
	border-collapse: collapse;
	width: 100%;
	font-size: 12px;
}

.status-map-matrix th,
.status-map-matrix td {
	padding: 7px 10px;
	text-align: left;
	border-bottom: 1px solid var(--statusmap-border, #e2e8f0);
	border-right: 1px solid var(--statusmap-border, #e2e8f0);
	white-space: nowrap;
}

.status-map-matrix thead th {
	position: sticky;
	top: 0;
	background: var(--statusmap-card, #f8fafc);
	font-weight: 700;
	color: var(--statusmap-text, #0f172a);
	z-index: 1;
}

.status-map-matrix__rowhead,
.status-map-matrix__corner {
	position: sticky;
	left: 0;
	background: var(--statusmap-card, #f8fafc);
	font-weight: 700;
	color: var(--statusmap-text, #0f172a);
	z-index: 1;
}

.status-map-matrix__corner {
	z-index: 2;
}

.status-map-matrix__cell {
	background: var(--tone-bg);
	color: var(--tone-fg);
	font-weight: 600;
}
</style>
