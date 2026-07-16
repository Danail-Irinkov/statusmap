export type RunLevel = 'feature' | 'spec' | 'test'

export interface RunTarget {
	level: RunLevel
	featureId?: string
	specs: string[]
	label: string
	watch?: boolean
	humanize?: boolean
}

export interface SpecTests {
	file: string
	tests: { title: string; line: number }[]
}

export type RunEvent =
	| { type: 'start'; cmd: string; label: string; specs: string[] }
	| { type: 'log'; line: string }
	| { type: 'frame'; data: string; test?: string; seq?: number }
	| { type: 'result'; exitCode: number; report: unknown }

export interface StatusMapRunnerOptions {
	enabled?: boolean
	run(target: RunTarget): AsyncIterable<RunEvent>
	focus?: string
	resultDwellMs?: number
	listTests?(target: { featureId: string; specs: string[] }): Promise<SpecTests[]>
}
