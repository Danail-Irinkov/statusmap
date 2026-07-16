<template>
	<div class="status-map-tree">
		<template
			v-for="(n, i) in shown"
			:key="`n-${i}`">
			<details
				v-if="n.children?.length"
				class="status-map-tree__node"
				:class="{ 'status-map-tree__node--running': isRunning(n.run) }"
				:open="n.verdict.tone === 'red'"
				:style="vars(n.verdict.tone)"
				:aria-busy="isRunning(n.run) ? 'true' : undefined">
				<summary class="status-map-tree__summary">
					<svg
						class="status-map-tree__chev"
						viewBox="0 0 16 16"
						fill="none"
						aria-hidden="true">
						<path
							d="M6 4l4 4-4 4"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round" />
					</svg>
					<span
						class="status-map-tree__pill"
						:style="vars(n.verdict.tone)"
						>{{ n.verdict.label }}</span
					>
					<span class="status-map-tree__name">{{ n.name }}</span>
					<span
						v-if="badge(n)"
						class="status-map-tree__badge"
						>{{ badge(n) }}</span
					>
					<button
						v-if="runnerEnabled && n.run"
						type="button"
						class="status-map-tree__run"
						data-statusmap-run
						:disabled="isRunning(n.run)"
						:aria-label="`Run ${n.run.label}`"
						@click.prevent.stop="run(n.run)">
						<span aria-hidden="true">▶</span>
						<span>Run</span>
					</button>
				</summary>
				<div class="status-map-tree__body">
					<StatusMapTestTree :nodes="n.children" />
				</div>
			</details>
			<div
				v-else
				class="status-map-tree__leaf"
				:class="{ 'status-map-tree__leaf--running': isRunning(n.run) }"
				:style="vars(n.verdict.tone)"
				:aria-busy="isRunning(n.run) ? 'true' : undefined">
				<span
					class="status-map-tree__pill"
					:style="vars(n.verdict.tone)"
					>{{ n.verdict.label }}</span
				>
				<span class="status-map-tree__name">{{ n.name }}</span>
				<button
					v-if="runnerEnabled && n.run"
					type="button"
					class="status-map-tree__run status-map-tree__run--icon"
					data-statusmap-run
					:disabled="isRunning(n.run)"
					:aria-label="`Run ${n.run.label}`"
					@click.prevent.stop="run(n.run)">
					<span aria-hidden="true">▶</span>
				</button>
			</div>
		</template>

		<details
			v-if="foldedLeaves.length"
			class="status-map-tree__node"
			:style="vars('live')">
			<summary class="status-map-tree__summary">
				<svg
					class="status-map-tree__chev"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true">
					<path
						d="M6 4l4 4-4 4"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round" />
				</svg>
				<span
					class="status-map-tree__pill"
					:style="vars('live')"
					>✓ {{ passCount }} passing</span
				>
			</summary>
			<div class="status-map-tree__body">
				<div
					v-for="(n, i) in foldedLeaves"
					:key="`p-${i}`"
					class="status-map-tree__leaf"
					:style="vars(n.verdict.tone)">
					<span
						class="status-map-tree__pill"
						:style="vars(n.verdict.tone)"
						>{{ n.verdict.label }}</span
					>
					<span class="status-map-tree__name">{{ n.name }}</span>
					<button
						v-if="runnerEnabled && n.run"
						type="button"
						class="status-map-tree__run status-map-tree__run--icon"
						data-statusmap-run
						:disabled="isRunning(n.run)"
						:aria-label="`Run ${n.run.label}`"
						@click.prevent.stop="run(n.run)">
						<span aria-hidden="true">▶</span>
					</button>
				</div>
			</div>
		</details>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { statusToneVars, type RunTarget, type StatusCardTreeNode, type StatusTone } from '@statusmap/core'
import { useStatusMapRunner } from './runner'
import { runStatusMapTarget } from './runner-actions'

defineOptions({ name: 'StatusMapTestTree' })
const props = defineProps<{ nodes: StatusCardTreeNode[] }>()

const vars = (tone: StatusTone) => statusToneVars(tone)
const runner = useStatusMapRunner()
const runnerEnabled = computed(() => !!runner?.enabled)
const runningKey = ref('')
const shown = computed(() => props.nodes.filter((n) => !n.passing || !!n.children?.length))
const foldedLeaves = computed(() => props.nodes.filter((n) => n.passing && !n.children?.length))
const passCount = computed(() => foldedLeaves.value.length)

function badge(n: StatusCardTreeNode): string {
	const total = n.counts.passed + n.counts.failed + n.counts.skipped
	if (total <= 1) return ''
	const parts: string[] = []
	if (n.counts.failed) parts.push(`${n.counts.failed}✗`)
	if (n.counts.skipped) parts.push(`${n.counts.skipped}○`)
	if (n.counts.passed) parts.push(`${n.counts.passed}✓`)
	return `${total} · ${parts.join(' ')}`
}

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
.status-map-tree {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.status-map-tree__node {
	border-left: 2px solid var(--tone-border, var(--statusmap-border, #e2e8f0));
	border-radius: 6px;
	background: var(--statusmap-page, #ffffff);
}

.status-map-tree__summary {
	list-style: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 7px;
	flex-wrap: wrap;
	padding: 5px 9px;
}

.status-map-tree__summary::-webkit-details-marker {
	display: none;
}

.status-map-tree__summary:focus-visible {
	outline: 2px solid var(--statusmap-active-fg, #1e40af);
	outline-offset: -2px;
	border-radius: 6px;
}

.status-map-tree__chev {
	flex: none;
	width: 11px;
	height: 11px;
	color: var(--statusmap-muted, #64748b);
	transition: transform 0.15s ease;
}

.status-map-tree__node[open] > .status-map-tree__summary .status-map-tree__chev {
	transform: rotate(90deg);
}

.status-map-tree__body {
	padding: 2px 0 4px 16px;
}

.status-map-tree__node--running > .status-map-tree__summary .status-map-tree__pill,
.status-map-tree__leaf--running .status-map-tree__pill {
	animation: status-map-tree-run-pulse 1s ease-in-out infinite;
}

.status-map-tree__leaf {
	display: flex;
	align-items: center;
	gap: 7px;
	flex-wrap: wrap;
	padding: 4px 9px;
	border-left: 2px solid var(--tone-dot, var(--statusmap-border, #e2e8f0));
	border-radius: 6px;
	background: var(--statusmap-page, #ffffff);
}

.status-map-tree__pill {
	flex: none;
	padding: 1px 8px;
	border-radius: 999px;
	background: var(--tone-bg);
	border: 1px solid var(--tone-border);
	color: var(--tone-fg);
	font-size: 10px;
	font-weight: 700;
	white-space: nowrap;
}

.status-map-tree__name {
	font-size: 12px;
	color: var(--statusmap-text, #0f172a);
}

.status-map-tree__badge {
	margin-left: auto;
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-size: 10px;
	color: var(--statusmap-muted, #64748b);
	white-space: nowrap;
}

.status-map-tree__run {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	flex: none;
	margin-left: auto;
	padding: 1px 8px;
	border: 1px solid var(--statusmap-active-border, var(--statusmap-border-strong, #cbd5e1));
	border-radius: 7px;
	background: var(--statusmap-page, #ffffff);
	color: var(--statusmap-active-fg, var(--statusmap-link, #0f766e));
	font: inherit;
	font-size: 10.5px;
	font-weight: 700;
	line-height: 1.25;
	cursor: pointer;
}

.status-map-tree__run--icon {
	width: 25px;
	padding-inline: 0;
}

.status-map-tree__run:hover {
	background: var(--statusmap-active-bg, var(--tone-bg));
}

.status-map-tree__run:focus-visible {
	outline: 2px solid var(--statusmap-active-fg, #1e40af);
	outline-offset: 2px;
}

.status-map-tree__run:disabled {
	cursor: wait;
	opacity: 0.75;
}

@keyframes status-map-tree-run-pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.45;
	}
}
</style>
