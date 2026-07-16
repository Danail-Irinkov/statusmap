import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunTarget, StatusMapRunnerOptions } from '@statusmap/core'
import { runStatusMapTarget } from '../src/runner-actions'

const mocked = vi.hoisted(() => ({
	callbacks: undefined as
		| {
				onTogglePause: () => void
				onNext: () => void
				onPrev: () => void
				onSelect?: (id: string) => void
		  }
		| undefined,
	tracks: [] as Array<{ id: string; label: string; spec: string; status: string }>,
	player: {
		closed: vi.fn(() => false),
		close: vi.fn(),
		setFrame: vi.fn(),
		setTrackStatus: vi.fn(),
		setCurrent: vi.fn(),
		setPending: vi.fn(),
		setPaused: vi.fn(),
	},
}))

vi.mock('../src/runner-window', () => ({
	createStatusMapRunPlayer: vi.fn((_title, tracks, callbacks) => {
		mocked.callbacks = callbacks
		mocked.tracks = tracks
		return mocked.player
	}),
}))

async function flushAsyncWork() {
	for (let i = 0; i < 20; i += 1) {
		await Promise.resolve()
	}
}

describe('runStatusMapTarget', () => {
	beforeEach(() => {
		vi.useRealTimers()
		mocked.callbacks = undefined
		mocked.player.closed.mockReset()
		mocked.player.closed.mockReturnValue(false)
		mocked.player.close.mockReset()
		mocked.player.setFrame.mockReset()
		mocked.player.setTrackStatus.mockReset()
		mocked.player.setCurrent.mockReset()
		mocked.player.setPending.mockReset()
		mocked.player.setPaused.mockReset()
	})

	it('resumes at the next queued track after pause holds at a completed track boundary', async () => {
		const calls: RunTarget[] = []
		const runner: StatusMapRunnerOptions = {
			enabled: true,
			resultDwellMs: 0,
			listTests: async () => [
				{
					file: 'account.spec.ts',
					tests: [
						{ title: 'first behavior', line: 10 },
						{ title: 'second behavior', line: 20 },
					],
				},
			],
			run: async function* (target) {
				calls.push(target)
				if (calls.length === 1) {
					mocked.callbacks?.onTogglePause()
				}
				yield { type: 'result', exitCode: 0, report: { suites: [] } }
			},
		}

		const promise = runStatusMapTarget(runner, {
			level: 'feature',
			featureId: 'account',
			specs: ['account.spec.ts'],
			label: 'Account',
			watch: true,
		})

		await vi.waitFor(() => expect(mocked.player.setPaused).toHaveBeenCalledWith(true))
		expect(calls.map((call) => call.specs)).toEqual([['account.spec.ts:10']])

		mocked.callbacks?.onTogglePause()
		await promise

		expect(calls.map((call) => call.specs)).toEqual([['account.spec.ts:10'], ['account.spec.ts:20']])
		expect(mocked.player.close).toHaveBeenCalledOnce()
	})

	it('keeps the completed track current during result dwell before auto-advancing', async () => {
		vi.useFakeTimers()
		const calls: RunTarget[] = []
		const runner: StatusMapRunnerOptions = {
			enabled: true,
			resultDwellMs: 1000,
			listTests: async () => [
				{
					file: 'account.spec.ts',
					tests: [
						{ title: 'first behavior', line: 10 },
						{ title: 'second behavior', line: 20 },
					],
				},
			],
			run: async function* (target) {
				calls.push(target)
				yield { type: 'result', exitCode: 0, report: { suites: [] } }
			},
		}

		const promise = runStatusMapTarget(runner, {
			level: 'feature',
			featureId: 'account',
			specs: ['account.spec.ts'],
			label: 'Account',
			watch: true,
		})

		await flushAsyncWork()
		expect(mocked.player.setTrackStatus).toHaveBeenCalledWith(expect.any(String), 'passed')
		const firstTrack = mocked.player.setCurrent.mock.calls[0]?.[0]

		expect(mocked.player.setCurrent).toHaveBeenLastCalledWith(firstTrack)
		expect(calls.map((call) => call.specs)).toEqual([['account.spec.ts:10']])

		await vi.advanceTimersByTimeAsync(999)
		expect(calls.map((call) => call.specs)).toEqual([['account.spec.ts:10']])

		await vi.advanceTimersByTimeAsync(1)
		await vi.waitFor(() => expect(calls.map((call) => call.specs)).toEqual([['account.spec.ts:10'], ['account.spec.ts:20']]))
		await vi.advanceTimersByTimeAsync(1000)
		await promise
	})

	it('applies next seek from the completed result without skipping a queued track', async () => {
		const calls: RunTarget[] = []
		const runner: StatusMapRunnerOptions = {
			enabled: true,
			resultDwellMs: 0,
			listTests: async () => [
				{
					file: 'account.spec.ts',
					tests: [
						{ title: 'first behavior', line: 10 },
						{ title: 'second behavior', line: 20 },
						{ title: 'third behavior', line: 30 },
					],
				},
			],
			run: async function* (target) {
				calls.push(target)
				if (calls.length === 1) {
					mocked.callbacks?.onTogglePause()
				}
				yield { type: 'result', exitCode: 0, report: { suites: [] } }
			},
		}

		const promise = runStatusMapTarget(runner, {
			level: 'feature',
			featureId: 'account',
			specs: ['account.spec.ts'],
			label: 'Account',
			watch: true,
		})

		await flushAsyncWork()
		expect(mocked.player.setTrackStatus).toHaveBeenCalledWith(expect.stringContaining('account.spec.ts:10'), 'passed')
		expect(calls.map((call) => call.specs)).toEqual([['account.spec.ts:10']])

		mocked.callbacks?.onNext()
		await promise

		expect(calls[1]?.specs).toEqual(['account.spec.ts:20'])
	})

	it('jumps to a clicked track and previews it as pending before the switch lands', async () => {
		const calls: RunTarget[] = []
		const runner: StatusMapRunnerOptions = {
			enabled: true,
			resultDwellMs: 0,
			listTests: async () => [
				{
					file: 'account.spec.ts',
					tests: [
						{ title: 'first behavior', line: 10 },
						{ title: 'second behavior', line: 20 },
						{ title: 'third behavior', line: 30 },
					],
				},
			],
			run: async function* (target) {
				calls.push(target)
				if (calls.length === 1) {
					mocked.callbacks?.onTogglePause()
				}
				yield { type: 'result', exitCode: 0, report: { suites: [] } }
			},
		}

		const promise = runStatusMapTarget(runner, {
			level: 'feature',
			featureId: 'account',
			specs: ['account.spec.ts'],
			label: 'Account',
			watch: true,
		})

		await flushAsyncWork()
		expect(calls.map((call) => call.specs)).toEqual([['account.spec.ts:10']])

		// Click the third track: it is previewed as pending immediately, then run at the next boundary.
		const third = mocked.tracks[2]
		mocked.callbacks?.onSelect?.(third.id)
		expect(mocked.player.setPending).toHaveBeenCalledWith(third.id)

		await promise
		expect(calls[1]?.specs).toEqual(['account.spec.ts:30'])
	})
})
