import { inject, provide, type InjectionKey } from 'vue'
import type { StatusMapRunnerOptions } from '@statusmap/core'

export const STATUS_MAP_RUNNER: InjectionKey<StatusMapRunnerOptions | null> = Symbol('status-map-runner')

export function provideStatusMapRunner(opts: StatusMapRunnerOptions) {
	provide(STATUS_MAP_RUNNER, opts)
}

export function useStatusMapRunner(): StatusMapRunnerOptions | null {
	return inject(STATUS_MAP_RUNNER, null)
}
