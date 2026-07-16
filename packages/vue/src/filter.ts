// The page-level legend filter (provide/inject) — the only interactivity in the renderer. It is
// progressive-enhancement: with no tones active every card shows, so the map reads fully with JS disabled.
// The page provides the filter; StatusMapLegend toggles it; StatusMapCards honors it. Components mounted
// with no provider (isolated tests) get an inert filter that never hides anything.

import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { StatusTone } from '@statusmap/core'

export type StatusMapFilter = {
	activeTones: Ref<StatusTone[]>
	anyActive: ComputedRef<boolean>
	isActive: (tone: StatusTone) => boolean
	toggle: (tone: StatusTone) => void
	clear: () => void
	// Card visibility: with nothing selected, everything shows (no-JS / unfiltered default).
	isVisible: (tone: StatusTone) => boolean
}

export const STATUS_MAP_FILTER: InjectionKey<StatusMapFilter> = Symbol('status-map-filter')

export function createStatusMapFilter(): StatusMapFilter {
	const activeTones = ref<StatusTone[]>([])
	const anyActive = computed(() => activeTones.value.length > 0)
	const isActive = (tone: StatusTone) => activeTones.value.includes(tone)
	const toggle = (tone: StatusTone) => {
		activeTones.value = isActive(tone)
			? activeTones.value.filter((t) => t !== tone)
			: [...activeTones.value, tone]
	}
	const clear = () => {
		activeTones.value = []
	}
	const isVisible = (tone: StatusTone) => !anyActive.value || isActive(tone)
	return { activeTones, anyActive, isActive, toggle, clear, isVisible }
}

// Inert singleton for components rendered without a providing page (isolated tests, no-JS).
const INERT: StatusMapFilter = {
	activeTones: ref<StatusTone[]>([]),
	anyActive: computed(() => false),
	isActive: () => false,
	toggle: () => {},
	clear: () => {},
	isVisible: () => true,
}

export function useStatusMapFilter(): StatusMapFilter {
	return inject(STATUS_MAP_FILTER, INERT)
}
