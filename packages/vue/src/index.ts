// @statusmap/vue — public API.
//
// The Vue 3 component family that renders a @statusmap/core `StatusMapDefinition`: the page renderer, the
// shared shell, the status atoms, and the section components. Plus the legend-filter and router-link
// composables. Import the default theme once: `import '@statusmap/vue/styles.css'`.

// The drop-in: YAML files in → rendered, filterable status page out. The everyday entry point.
export { default as StatusMap } from './StatusMap.vue'

// Advanced / lower-level (you usually only need <StatusMap>):
export { default as StatusMapPage } from './StatusMapPage.vue'
export { default as StatusMapExplorer } from './StatusMapExplorer.vue'
export { default as StatusMapShell } from './StatusMapShell.vue'
export { default as StatusMapBadge } from './StatusMapBadge.vue'
export { default as StatusMapChip } from './StatusMapChip.vue'
export { default as StatusMapHeader } from './StatusMapHeader.vue'
export { default as StatusMapLegend } from './StatusMapLegend.vue'
export { default as StatusMapFlow } from './StatusMapFlow.vue'
export { default as StatusMapCards } from './StatusMapCards.vue'
export { default as StatusMapTestTree } from './StatusMapTestTree.vue'
export { default as StatusMapLadder } from './StatusMapLadder.vue'
export { default as StatusMapMatrix } from './StatusMapMatrix.vue'
export { default as StatusMapTimeline } from './StatusMapTimeline.vue'
export { default as StatusMapPanel } from './StatusMapPanel.vue'

export * from './filter'
export * from './link'
export * from './runner'
export type { RunEvent, RunLevel, RunTarget, SpecTests, StatusMapRunnerOptions } from '@statusmap/core'
