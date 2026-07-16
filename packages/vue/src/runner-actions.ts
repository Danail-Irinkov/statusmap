import type { RunEvent, RunTarget, SpecTests, StatusMapRunnerOptions } from '@statusmap/core'
import { createStatusMapRunPlayer, type StatusMapRunPlayer, type StatusMapRunTrack } from './runner-window'

type EventSink = (event: RunEvent, target: RunTarget) => void | Promise<void>
const DEFAULT_RESULT_DWELL_MS = 2500

function fallbackTracks(target: RunTarget): StatusMapRunTrack[] {
	return target.specs.map((spec, i) => ({
		id: `${i}:${spec}`,
		label: target.specs.length === 1 ? target.label : spec,
		spec,
		status: 'queued',
	}))
}

function flattenTests(target: RunTarget, specs: SpecTests[]): StatusMapRunTrack[] {
	const tracks: StatusMapRunTrack[] = []
	for (const file of specs) {
		for (const test of file.tests) {
			const spec = test.line > 0 ? `${file.file}:${test.line}` : file.file
			tracks.push({
				id: `${tracks.length}:${spec}:${test.title}`,
				label: test.title,
				spec,
				status: 'queued',
			})
		}
	}
	return tracks.length ? tracks : fallbackTracks(target)
}

async function selectedTracks(runner: StatusMapRunnerOptions, target: RunTarget): Promise<StatusMapRunTrack[]> {
	if (target.watch && runner.listTests && target.featureId) {
		try {
			return flattenTests(target, await runner.listTests({ featureId: target.featureId, specs: target.specs }))
		} catch {
			return fallbackTracks(target)
		}
	}
	return fallbackTracks(target)
}

async function consumeRun(
	runner: StatusMapRunnerOptions,
	target: RunTarget,
	player: StatusMapRunPlayer | null,
	track: StatusMapRunTrack | undefined,
	onEvent?: EventSink,
) {
	let exitCode = 0
	for await (const event of runner.run(target)) {
		if (event.type === 'frame') {
			player?.setFrame(event.data)
		}
		if (event.type === 'result') {
			exitCode = event.exitCode
		}
		await onEvent?.(event, target)
	}
	if (track) {
		player?.setTrackStatus(track.id, exitCode === 0 ? 'passed' : 'failed')
	}
}

function resultDwellMs(runner: StatusMapRunnerOptions): number {
	return Math.max(0, runner.resultDwellMs ?? DEFAULT_RESULT_DWELL_MS)
}

export async function runStatusMapTarget(
	runner: StatusMapRunnerOptions,
	target: RunTarget,
	onEvent?: EventSink,
) {
	if (!target.watch) {
		await consumeRun(runner, target, null, undefined, onEvent)
		return
	}

	const tracks = await selectedTracks(runner, target)
	let index = 0
	let paused = false
	// A buffered navigation request from the transport controls OR a track click. It is APPLIED at the
	// next track boundary — the in-flight run is never interrupted (it can be placing a real order on the
	// dev backend). For immediate feedback, the would-be target is reflected in the player the moment it
	// is requested (setPending), and a pending request shortens the result dwell so the switch is prompt.
	type NavRequest = { kind: 'next' } | { kind: 'prev' } | { kind: 'goto'; index: number }
	let requested: NavRequest | null = null
	let resume: (() => void) | null = null
	let wakeDwell: (() => void) | null = null
	let player: StatusMapRunPlayer | null = null
	const dwellMs = resultDwellMs(runner)
	const targetIndexFor = (action: NavRequest, from: number) => {
		if (action.kind === 'next') return Math.min(from + 1, tracks.length - 1)
		if (action.kind === 'prev') return Math.max(from - 1, 0)
		return Math.max(0, Math.min(action.index, tracks.length - 1))
	}
	const applyRequested = (from: number) => {
		const action = requested
		requested = null
		return action ? targetIndexFor(action, from) : from
	}
	// Highlight the would-be target so a click visibly "lands" even while the current run is mid-flight
	// (null when the target is the current track, e.g. prev at the first track — nothing to preview).
	const reflectPending = () => {
		if (!requested) return
		const target = targetIndexFor(requested, index)
		player?.setPending(target !== index ? tracks[target]?.id ?? null : null)
	}
	const requestNav = (action: NavRequest) => {
		requested = action
		paused = false
		player?.setPaused(false)
		reflectPending()
		if (resume) {
			resume()
			resume = null
		}
		// The human picked where to go next — don't make them sit through the rest of the result dwell.
		if (wakeDwell) {
			wakeDwell()
			wakeDwell = null
		}
	}
	const waitForPlay = () =>
		paused
			? new Promise<void>((resolve) => {
					resume = resolve
				})
			: Promise.resolve()
	// Hold a finished track's pass/fail on screen so a human can read it, but let a nav request cut it short.
	const dwell = (ms: number) =>
		ms > 0
			? new Promise<void>((resolve) => {
					const finish = () => {
						wakeDwell = null
						clearTimeout(timer)
						resolve()
					}
					const timer = setTimeout(finish, ms)
					wakeDwell = finish
				})
			: Promise.resolve()

	player = createStatusMapRunPlayer(`LIVE RUN · ${target.label}`, tracks, {
		onTogglePause: () => {
			paused = !paused
			player?.setPaused(paused)
			if (!paused && resume) {
				resume()
				resume = null
			}
		},
		onNext: () => requestNav({ kind: 'next' }),
		onPrev: () => requestNav({ kind: 'prev' }),
		onSelect: (id: string) => {
			const i = tracks.findIndex((track) => track.id === id)
			if (i >= 0) requestNav({ kind: 'goto', index: i })
		},
	})

	try {
		while (index >= 0 && index < tracks.length && !player?.closed()) {
			await waitForPlay()
			if (requested) {
				index = applyRequested(index)
			}
			if (index < 0 || index >= tracks.length) break
			const track = tracks[index]
			player?.setCurrent(track.id)
			player?.setTrackStatus(track.id, 'running')
			await consumeRun(
				runner,
				{ ...target, level: tracks.length === 1 ? target.level : 'test', specs: [track.spec], label: track.label, watch: true },
				player,
				track,
				onEvent,
			)
			// Dwell on the result so it's readable — unless a nav target is already queued (go now).
			await dwell(requested ? 0 : dwellMs)
			await waitForPlay()
			if (requested) {
				index = applyRequested(index)
			} else {
				index += 1
			}
		}
	} finally {
		player?.close()
	}
}
