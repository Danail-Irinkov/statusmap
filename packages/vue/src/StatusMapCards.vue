<template>
	<StatusMapShell
		kind="cards"
		:num="section.num"
		:title="section.title"
		:subtitle="section.subtitle"
		:tone="section.tone"
		:anchor-id="section.id">
		<div class="status-map-cards">
			<details
				v-for="(card, i) in section.items"
				v-show="filter.isVisible(card.tone)"
				:key="`card-${i}`"
				class="status-map-cards__card"
				:class="{ 'status-map-cards__card--running': isRunning(card.run) }"
				:style="vars(card.tone)"
				:data-tone="card.tone"
				:aria-busy="isRunning(card.run) ? 'true' : undefined">
				<summary class="status-map-cards__summary">
					<svg
						class="status-map-cards__chev"
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
						class="status-map-cards__dot"
						aria-hidden="true"></span>
					<span class="status-map-cards__name">{{ card.name }}</span>
					<span
						v-if="card.statusLabel"
						class="status-map-cards__pill status-map-cards__pill--status"
						:style="vars(card.tone)"
						>{{ card.statusLabel }}</span
					>
					<span
						v-if="card.tested"
						class="status-map-cards__pill"
						:style="vars(card.tested.tone)"
						>{{ card.tested.label }}</span
					>
					<span
						v-if="card.blocking"
						class="status-map-cards__pill"
						:style="vars(card.blocking.tone)"
						>{{ card.blocking.label }}</span
					>
					<button
						v-if="runnerEnabled && card.run"
						type="button"
						class="status-map-cards__run"
						data-statusmap-run
						:disabled="isRunning(card.run)"
						:aria-label="`Run ${card.run.label}`"
						@click.prevent.stop="run(card.run)">
						<span aria-hidden="true">▶</span>
						<span>Run</span>
					</button>
				</summary>

				<div class="status-map-cards__body">
					<p
						v-if="card.intent"
						class="status-map-cards__intent">
						{{ card.intent }}
						<sup
							v-if="card.note"
							class="status-map-cards__note"
							:title="card.note.text"
							>{{ card.note.marker }}</sup
						>
					</p>

					<div
						v-if="card.meta?.length"
						class="status-map-cards__group">
						<span class="status-map-cards__group-label">Workflows</span>
						<div
							v-for="(chip, ci) in card.meta"
							:key="`wf-${ci}`"
							class="status-map-cards__wf">
							<span
								class="status-map-cards__wf-dot"
								:style="vars(chip.tone || 'neutral')"
								aria-hidden="true"></span>
							<span class="status-map-cards__wf-name">{{ chip.label }}</span>
							<span
								v-if="chip.title"
								class="status-map-cards__wf-note"
								>{{ chip.title }}</span
							>
						</div>
					</div>

					<div
						v-if="card.coverage?.length"
						class="status-map-cards__group">
						<span class="status-map-cards__group-label">Coverage</span>
						<div class="status-map-cards__chips">
							<StatusMapChip
								v-for="(chip, ci) in card.coverage"
								:key="`cov-${ci}`"
								:chip="chip" />
						</div>
					</div>

					<div
						v-if="card.testTree?.length"
						class="status-map-cards__group">
						<span class="status-map-cards__group-label">Tests</span>
						<StatusMapTestTree :nodes="card.testTree" />
					</div>

					<div
						v-if="card.blockers?.length"
						class="status-map-cards__group">
						<span class="status-map-cards__group-label">Blocking</span>
						<ul class="status-map-cards__blockers">
							<li
								v-for="(b, bi) in card.blockers"
								:key="`bl-${bi}`">
								{{ b }}
							</li>
						</ul>
					</div>
				</div>
			</details>
		</div>
	</StatusMapShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { statusToneVars, type CardsSection, type RunTarget, type StatusTone } from '@statusmap/core'
import { useStatusMapFilter } from './filter'
import { useStatusMapRunner } from './runner'
import { runStatusMapTarget } from './runner-actions'
import StatusMapShell from './StatusMapShell.vue'
import StatusMapChip from './StatusMapChip.vue'
import StatusMapTestTree from './StatusMapTestTree.vue'

defineOptions({ name: 'StatusMapCards' })
defineProps<{ section: CardsSection }>()

const filter = useStatusMapFilter()
const runner = useStatusMapRunner()
const runningKey = ref('')
const runnerEnabled = computed(() => !!runner?.enabled)
const vars = (tone: StatusTone) => statusToneVars(tone)

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
.status-map-cards {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 0;
	padding: 0;
}

.status-map-cards__card {
	border: 1px solid var(--statusmap-border, #e2e8f0);
	border-left: 3px solid var(--tone-dot, var(--statusmap-border, #e2e8f0));
	border-radius: 10px;
	background: var(--statusmap-page, #ffffff);
	overflow: hidden;
}

.status-map-cards__summary {
	list-style: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	padding: 11px 13px;
}

.status-map-cards__summary::-webkit-details-marker {
	display: none;
}

.status-map-cards__summary:focus-visible {
	outline: 2px solid var(--statusmap-active-fg, #1e40af);
	outline-offset: -2px;
	border-radius: 9px;
}

.status-map-cards__chev {
	flex: none;
	width: 13px;
	height: 13px;
	color: var(--statusmap-muted, #64748b);
	transition: transform 0.15s ease;
}

.status-map-cards__card[open] .status-map-cards__chev {
	transform: rotate(90deg);
}

.status-map-cards__card--running .status-map-cards__dot {
	animation: status-map-run-pulse 1s ease-in-out infinite;
}

.status-map-cards__dot {
	flex: none;
	width: 9px;
	height: 9px;
	border-radius: 999px;
	background: var(--tone-dot);
}

.status-map-cards__name {
	font-size: 14px;
	font-weight: 700;
	color: var(--statusmap-text, #0f172a);
	margin-right: auto;
}

.status-map-cards__pill {
	flex: none;
	padding: 2px 9px;
	border-radius: 999px;
	background: var(--tone-bg);
	border: 1px solid var(--tone-border);
	color: var(--tone-fg);
	font-size: 10.5px;
	font-weight: 700;
	white-space: nowrap;
}

.status-map-cards__pill--status {
	text-transform: uppercase;
	letter-spacing: 0.03em;
	font-size: 10px;
}

.status-map-cards__run {
	display: inline-flex;
	align-items: center;
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

.status-map-cards__run:hover {
	background: var(--statusmap-active-bg, var(--tone-bg));
}

.status-map-cards__run:focus-visible {
	outline: 2px solid var(--statusmap-active-fg, #1e40af);
	outline-offset: 2px;
}

.status-map-cards__run:disabled {
	cursor: wait;
	opacity: 0.75;
}

.status-map-cards__body {
	padding: 0 13px 12px 34px;
	border-top: 1px solid var(--statusmap-border, #e2e8f0);
}

.status-map-cards__intent {
	margin: 10px 0 0;
	font-size: 12.5px;
	line-height: 1.5;
	color: var(--statusmap-muted, #64748b);
}

.status-map-cards__note {
	margin-left: 2px;
	color: var(--statusmap-active-fg, #1e40af);
	font-weight: 700;
	cursor: help;
}

.status-map-cards__group {
	margin-top: 12px;
}

.status-map-cards__group-label {
	display: block;
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--statusmap-muted, #64748b);
	margin-bottom: 6px;
}

.status-map-cards__wf {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 7px;
	padding: 4px 0;
	font-size: 12.5px;
	border-bottom: 1px dashed var(--statusmap-border, #e2e8f0);
}

.status-map-cards__wf:last-child {
	border-bottom: 0;
}

.status-map-cards__wf-dot {
	flex: none;
	width: 7px;
	height: 7px;
	border-radius: 999px;
	background: var(--tone-dot);
}

.status-map-cards__wf-name {
	color: var(--statusmap-text, #0f172a);
}

.status-map-cards__wf-note {
	flex-basis: 100%;
	padding-left: 14px;
	color: var(--statusmap-muted, #64748b);
	font-size: 11.5px;
	font-style: italic;
}

.status-map-cards__chips {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.status-map-cards__blockers {
	margin: 0;
	padding: 0;
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.status-map-cards__blockers li {
	position: relative;
	padding-left: 18px;
	font-size: 12px;
	line-height: 1.45;
	color: var(--statusmap-problem-fg, #991b1b);
}

.status-map-cards__blockers li::before {
	content: '⚠';
	position: absolute;
	left: 0;
	top: 1px;
	font-size: 11px;
}

@keyframes status-map-run-pulse {
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
</style>
