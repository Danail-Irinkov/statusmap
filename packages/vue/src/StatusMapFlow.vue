<template>
	<StatusMapShell
		kind="flow"
		:num="section.num"
		:title="section.title"
		:subtitle="section.subtitle"
		:tone="section.tone"
		:anchor-id="section.id">
		<ol
			class="status-map-flow"
			:class="`status-map-flow--${layout}`">
			<li
				v-for="(node, i) in section.nodes"
				:key="node.id"
				class="status-map-flow__item">
				<div class="status-map-flow__node-wrap">
					<component
						:is="node.to ? link.component : 'div'"
						v-bind="node.to ? { [link.prop]: node.to } : {}"
						class="status-map-flow__node"
						:style="vars(node.tone)"
						:class="{
							'status-map-flow__node--toned': !!node.tone,
							'status-map-flow__node--link': !!node.to,
							'status-map-flow__node--running': isRunning(node.run),
							'status-map-flow__node--runnable': runnerEnabled && !!node.run,
						}"
						:aria-busy="isRunning(node.run) ? 'true' : undefined">
						<p class="status-map-flow__node-title">
							<span
								v-if="node.tone"
								class="status-map-flow__node-dot"
								aria-hidden="true"></span>
							<span>{{ node.title }}</span>
							<span
								v-if="node.to"
								class="status-map-flow__chevron"
								aria-hidden="true">›</span>
						</p>
						<p
							v-if="node.statusLabel"
							class="status-map-flow__node-status">{{ node.statusLabel }}</p>
						<p
							v-if="node.body"
							class="status-map-flow__node-body">{{ node.body }}</p>

						<!-- Parent rollup: a brief summary of the statuses inside this grouping. -->
						<div
							v-if="node.rollup || node.scopeProgress"
							class="status-map-flow__rollup">
							<div
								v-if="node.rollup"
								class="status-map-flow__bar">
								<span
									v-for="(c, ci) in node.rollup.counts"
									:key="`bar-${ci}`"
									class="status-map-flow__bar-seg"
									:style="{ flexGrow: c.count, background: toneDot(c.tone) }"
									:title="`${c.count} ${c.tone}`"></span>
							</div>
							<p
								v-if="node.rollup"
								class="status-map-flow__rollup-line">
								<span class="status-map-flow__pct">Working now: {{ node.rollup.healthPct }}%</span>
								<span class="status-map-flow__rollup-counts">
									<span
										v-for="(c, ci) in node.rollup.counts"
										:key="`cnt-${ci}`"
										class="status-map-flow__count">
										<span
											class="status-map-flow__count-dot"
											:style="{ background: toneDot(c.tone) }"
											aria-hidden="true"></span>{{ c.count }}
									</span>
								</span>
							</p>
							<p
								v-if="node.scopeProgress"
								class="status-map-flow__rollup-line status-map-flow__scope-line">
								<span class="status-map-flow__pct">
									{{ node.scopeProgress.label }}: {{ node.scopeProgress.percent }}%
								</span>
								<span
									v-if="node.scopeProgress.inferred"
									class="status-map-flow__inferred">inferred</span>
							</p>
						</div>

						<div
							v-if="node.lanes?.length"
							class="status-map-flow__lanes">
							<StatusMapChip
								v-for="(lane, li) in node.lanes"
								:key="`lane-${li}`"
								:chip="lane" />
						</div>
					</component>
					<button
						v-if="runnerEnabled && node.run"
						type="button"
						class="status-map-flow__run"
						data-statusmap-run
						:disabled="isRunning(node.run)"
						:aria-label="`Run ${node.run.label}`"
						@click.prevent.stop="run(node.run)">
						<span aria-hidden="true">▶</span>
						<span>Run</span>
					</button>
				</div>

				<!-- Pipeline connectors only (a grid of grouping cards has no inter-node arrows). -->
				<div
					v-if="layout === 'pipeline' && i < section.nodes.length - 1"
					class="status-map-flow__edge"
					aria-hidden="true">
					<span class="status-map-flow__arrow"></span>
					<span
						v-if="connectorLabel(i)"
						class="status-map-flow__edge-label">{{ connectorLabel(i) }}</span>
				</div>
			</li>
		</ol>
		<ul
			v-if="layout === 'pipeline' && extraEdges.length"
			class="status-map-flow__extra">
			<li
				v-for="(e, i) in extraEdges"
				:key="`e-${i}`">
				{{ titleOf(e.from) }} → {{ titleOf(e.to) }}<template v-if="e.label">: {{ e.label }}</template>
			</li>
		</ul>
	</StatusMapShell>
</template>

<script setup lang="ts">
// Section: a node → edge flow. Two layouts: `pipeline` draws arrows between consecutive nodes (a process
// flow); `grid` lays nodes out as a wrapping grid of clickable grouping cards (the explorer's flowchart
// levels). Nodes with `to` render through the injected link component (router-agnostic, deep-linkable, and
// reads with JS disabled), can show health + scope summaries of the statuses inside them, and a status label.
import { computed, ref } from 'vue'
import { statusTone, statusToneVars, type FlowSection, type RunTarget, type StatusTone } from '@statusmap/core'
import { useStatusMapLink } from './link'
import { useStatusMapRunner } from './runner'
import { runStatusMapTarget } from './runner-actions'
import StatusMapShell from './StatusMapShell.vue'
import StatusMapChip from './StatusMapChip.vue'

defineOptions({ name: 'StatusMapFlow' })
const props = defineProps<{ section: FlowSection }>()

const link = useStatusMapLink()
const runner = useStatusMapRunner()
const runnerEnabled = computed(() => !!runner?.enabled)
const runningKey = ref('')

const layout = computed(() => props.section.layout || 'pipeline')
const edges = computed(() => props.section.edges || [])
const vars = (tone?: StatusTone) => (tone ? statusToneVars(tone) : {})
const toneDot = (tone: StatusTone) => statusTone(tone).dot
const titleOf = (id: string) => props.section.nodes.find((n) => n.id === id)?.title || id

const edgeBetween = (i: number) => {
	const from = props.section.nodes[i]?.id
	const to = props.section.nodes[i + 1]?.id
	return edges.value.find((e) => e.from === from && e.to === to)
}
const connectorLabel = (i: number) => edgeBetween(i)?.label || ''

const extraEdges = computed(() => {
	const consecutive = new Set<string>()
	for (let i = 0; i < props.section.nodes.length - 1; i++) {
		const e = edgeBetween(i)
		if (e) {
			consecutive.add(`${e.from}->${e.to}`)
		}
	}
	return edges.value.filter((e) => !consecutive.has(`${e.from}->${e.to}`))
})

function keyOf(target?: RunTarget): string {
	return target ? `${target.level}:${target.featureId || ''}:${target.specs.join('|')}:${target.label}` : ''
}

function isRunning(target?: RunTarget) {
	return !!target && runningKey.value === keyOf(target)
}

async function run(target: RunTarget) {
	if (!runner || !runner.enabled || isRunning(target)) return
	runningKey.value = keyOf(target)
	try {
		await runStatusMapTarget(runner, target)
	} finally {
		runningKey.value = ''
	}
}
</script>

<style scoped>
.status-map-flow {
	display: flex;
	flex-direction: column;
	gap: 0;
	margin: 0;
	padding: 0;
	list-style: none;
}

/* Grid layout: a wrapping grid of clickable grouping cards. */
.status-map-flow--grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	gap: 10px;
}

.status-map-flow--grid .status-map-flow__item {
	display: block;
}

.status-map-flow__node-wrap {
	position: relative;
	height: 100%;
	min-width: 0;
}

.status-map-flow__node {
	box-sizing: border-box;
	display: block;
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-radius: 12px;
	background: var(--statusmap-card, #f8fafc);
	padding: 12px 14px;
	color: inherit;
	text-decoration: none;
	height: 100%;
}

.status-map-flow__node--runnable {
	padding-right: 82px;
}

.status-map-flow__node--toned {
	border-color: var(--tone-border);
	background: var(--tone-bg);
}

.status-map-flow__node--running .status-map-flow__node-dot {
	animation: status-map-flow-run-pulse 1s ease-in-out infinite;
}

.status-map-flow__node--link {
	cursor: pointer;
	transition: box-shadow 0.12s ease, transform 0.12s ease;
}

.status-map-flow__node--link:hover {
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	transform: translateY(-1px);
}

.status-map-flow__node--link:focus-visible {
	outline: 2px solid var(--statusmap-link, #0f766e);
	outline-offset: 2px;
}

.status-map-flow__node-title {
	display: flex;
	align-items: center;
	gap: 7px;
	margin: 0;
	font-size: 14px;
	font-weight: 700;
	color: var(--statusmap-text, #0f172a);
}

.status-map-flow__node--toned .status-map-flow__node-title {
	color: var(--tone-fg);
}

.status-map-flow__node-dot {
	flex: none;
	width: 9px;
	height: 9px;
	border-radius: 999px;
	background: var(--tone-dot);
}

.status-map-flow__chevron {
	margin-left: auto;
	font-size: 20px;
	line-height: 1;
	opacity: 0.6;
}

.status-map-flow__run {
	position: absolute;
	top: 12px;
	right: 14px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	flex: none;
	padding: 2px 8px;
	border: 1px solid var(--statusmap-active-border, var(--statusmap-border-strong, #cbd5e1));
	border-radius: 7px;
	background: var(--statusmap-page, #ffffff);
	color: var(--statusmap-active-fg, var(--statusmap-link, #0f766e));
	font: inherit;
	font-size: 11px;
	font-weight: 700;
	line-height: 1.2;
	cursor: pointer;
}

.status-map-flow__run:hover {
	background: var(--statusmap-active-bg, var(--tone-bg));
}

.status-map-flow__run:focus-visible {
	outline: 2px solid var(--statusmap-active-fg, #1e40af);
	outline-offset: 2px;
}

.status-map-flow__run:disabled {
	cursor: wait;
	opacity: 0.75;
}

.status-map-flow__node-status {
	margin: 3px 0 0;
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.03em;
	color: var(--statusmap-muted, #64748b);
}

.status-map-flow__node--toned .status-map-flow__node-status {
	color: var(--tone-fg);
	opacity: 0.9;
}

.status-map-flow__node-body {
	margin: 6px 0 0;
	font-size: 12px;
	line-height: 1.45;
	color: var(--statusmap-muted, #64748b);
}

.status-map-flow__node--toned .status-map-flow__node-body {
	color: var(--tone-fg);
	opacity: 0.88;
}

/* Rollup */
.status-map-flow__rollup {
	margin-top: 10px;
}

.status-map-flow__bar {
	display: flex;
	height: 7px;
	border-radius: 999px;
	overflow: hidden;
	background: var(--statusmap-neutral-bg, #f1f5f9);
}

.status-map-flow__bar-seg {
	min-width: 3px;
}

.status-map-flow__rollup-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin: 6px 0 0;
	font-size: 11px;
	color: var(--statusmap-muted, #64748b);
}

.status-map-flow__pct {
	font-weight: 700;
	color: var(--statusmap-text, #0f172a);
}

.status-map-flow__rollup-counts {
	display: flex;
	gap: 8px;
}

.status-map-flow__scope-line {
	margin-top: 3px;
}

.status-map-flow__inferred {
	font-size: 10px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.03em;
	color: var(--statusmap-text, #0f172a);
	opacity: 0.72;
}

.status-map-flow__count {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	font-weight: 600;
}

.status-map-flow__count-dot {
	width: 7px;
	height: 7px;
	border-radius: 999px;
}

.status-map-flow__lanes {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 8px;
}

/* Pipeline connectors */
.status-map-flow__edge {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
	padding: 6px 0;
}

.status-map-flow__arrow {
	width: 2px;
	height: 16px;
	background: var(--statusmap-border-strong, #cbd5e1);
	position: relative;
}

.status-map-flow__arrow::after {
	content: '';
	position: absolute;
	left: 50%;
	bottom: -1px;
	width: 7px;
	height: 7px;
	border-right: 2px solid var(--statusmap-border-strong, #cbd5e1);
	border-bottom: 2px solid var(--statusmap-border-strong, #cbd5e1);
	transform: translateX(-50%) rotate(45deg);
}

.status-map-flow__edge-label {
	font-size: 11px;
	font-weight: 600;
	color: var(--statusmap-muted, #64748b);
}

.status-map-flow__extra {
	margin: 14px 0 0;
	padding: 0;
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 12px;
	color: var(--statusmap-muted, #64748b);
}

@media (min-width: 768px) {
	.status-map-flow--pipeline {
		flex-direction: row;
		align-items: stretch;
		flex-wrap: wrap;
	}

	.status-map-flow--pipeline .status-map-flow__item {
		display: flex;
		flex-direction: row;
		align-items: center;
		flex: 1 1 0;
		min-width: 0;
	}

	.status-map-flow--pipeline .status-map-flow__node-wrap {
		flex: 1 1 0;
		min-width: 0;
	}

	.status-map-flow--pipeline .status-map-flow__edge {
		padding: 0 10px;
	}

	.status-map-flow--pipeline .status-map-flow__arrow {
		width: 18px;
		height: 2px;
	}

	.status-map-flow--pipeline .status-map-flow__arrow::after {
		left: auto;
		right: -1px;
		bottom: 50%;
		transform: translateY(50%) rotate(-45deg);
	}
}

@keyframes status-map-flow-run-pulse {
	0%,
	100% {
		opacity: 1;
		transform: scale(1);
	}
	50% {
		opacity: 0.4;
		transform: scale(1.25);
	}
}

@media (prefers-reduced-motion: reduce) {
	.status-map-flow__node--link {
		transition: none;
	}

	.status-map-flow__node--link:hover {
		transform: none;
	}

	.status-map-flow__node--running .status-map-flow__node-dot {
		animation: none;
	}
}
</style>
