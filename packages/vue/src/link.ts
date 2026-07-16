// Router-agnostic link injection (the framework decouple). Drill links — flow nodes, explorer breadcrumbs —
// render through whatever link component you provide; with no provider they fall back to a plain `<a>`, so
// the renderer works in any Vue 3 app with no Nuxt / vue-router assumption baked in.

import { inject, provide, type Component, type InjectionKey } from 'vue'

export type StatusMapLink = {
	// The component (or intrinsic tag) used to render a navigation link. Default: 'a'.
	component: Component | string
	// The prop carrying the destination on that component. 'href' for `<a>`; 'to' for RouterLink / NuxtLink.
	prop: string
}

const DEFAULT_LINK: StatusMapLink = { component: 'a', prop: 'href' }

export const STATUS_MAP_LINK: InjectionKey<StatusMapLink> = Symbol('status-map-link')

// Call inside a parent component's setup() to route all status-map links through your router:
//   provideStatusMapLink({ component: RouterLink, prop: 'to' })                    // vue-router
//   provideStatusMapLink({ component: resolveComponent('NuxtLink'), prop: 'to' })  // Nuxt
export function provideStatusMapLink(link: StatusMapLink) {
	provide(STATUS_MAP_LINK, link)
}

export function useStatusMapLink(): StatusMapLink {
	return inject(STATUS_MAP_LINK, DEFAULT_LINK)
}
