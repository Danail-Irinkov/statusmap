<template>
	<section
		:id="anchorId || undefined"
		class="status-map-shell"
		:class="[`status-map-shell--${tone}`, { 'status-map-shell--no-top-divider': noTopDivider }]"
		:data-section-kind="kind || undefined">
		<div class="status-map-shell__inner">
			<header
				v-if="num || title || subtitle"
				class="status-map-shell__head">
				<p class="status-map-shell__heading">
					<span
						v-if="num"
						class="status-map-shell__num">{{ num }}</span>
					<span
						v-if="title"
						class="status-map-shell__title">{{ title }}</span>
				</p>
				<p
					v-if="subtitle"
					class="status-map-shell__subtitle">{{ subtitle }}</p>
			</header>
			<div class="status-map-shell__body">
				<slot />
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
// Shared shell for every status-map section. Owns: top divider, tone background (page/card), max-width +
// gutters, anchor id, the num/title/subtitle heading block, and the no-horizontal-overflow wrapper.
// Sections render their body through the default slot.
defineOptions({ name: 'StatusMapShell' })

withDefaults(
	defineProps<{
		tone?: 'page' | 'card'
		num?: string
		title?: string
		subtitle?: string
		anchorId?: string
		kind?: string
		noTopDivider?: boolean
	}>(),
	{ tone: 'page', num: '', title: '', subtitle: '', anchorId: '', kind: '', noTopDivider: false },
)
</script>

<style scoped>
.status-map-shell {
	border-top: 1px solid var(--statusmap-border, #e2e8f0);
	background: var(--statusmap-page, #ffffff);
	overflow-x: clip;
	padding-block: 1.75rem;
}

.status-map-shell--card {
	background: var(--statusmap-card, #f8fafc);
}

.status-map-shell--no-top-divider {
	border-top: none;
}

.status-map-shell__inner {
	max-width: 60rem;
	margin-inline: auto;
	padding-inline: 20px;
}

.status-map-shell__head {
	margin-bottom: 1rem;
}

.status-map-shell__heading {
	display: flex;
	align-items: baseline;
	gap: 10px;
	margin: 0;
}

.status-map-shell__num {
	flex: none;
	font-family: var(--statusmap-font-mono, ui-monospace, monospace);
	font-size: 12px;
	font-weight: 700;
	color: var(--statusmap-muted, #64748b);
}

.status-map-shell__title {
	font-family: var(--statusmap-font-display, ui-sans-serif, system-ui, sans-serif);
	font-size: clamp(1.1rem, 2.5vw, 1.4rem);
	font-weight: 600;
	letter-spacing: -0.01em;
	color: var(--statusmap-text, #0f172a);
}

.status-map-shell__subtitle {
	margin: 4px 0 0;
	font-size: 13px;
	line-height: 1.5;
	color: var(--statusmap-muted, #64748b);
}

@media (min-width: 768px) {
	.status-map-shell {
		padding-block: 2.25rem;
	}

	.status-map-shell__inner {
		padding-inline: 28px;
	}
}
</style>
