import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStatusMapRunPlayer } from '../src/runner-window'

describe('createStatusMapRunPlayer', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('shows final result text and progress state on a completed track', () => {
		const childDocument = document.implementation.createHTMLDocument('')
		const child = {
			closed: false,
			close: vi.fn(),
			document: childDocument,
		}
		vi.spyOn(window, 'open').mockReturnValue(child as unknown as Window)

		const player = createStatusMapRunPlayer(
			'Live run',
			[{ id: 'track-1', label: 'first behavior', spec: 'account.spec.ts:10', status: 'queued' }],
			{ onTogglePause: vi.fn(), onNext: vi.fn(), onPrev: vi.fn() },
		)

		player?.setTrackStatus('track-1', 'failed')

		const row = childDocument.querySelector('[data-track="track-1"]')
		expect(row?.querySelector('.track__result')?.textContent).toBe('✗ failed')
		expect(childDocument.getElementById('progress')?.textContent).toBe('track 1 / 1 · failed')
	})

	it('treats screencast frame data as an image URL value, never as HTML', () => {
		const childDocument = document.implementation.createHTMLDocument('')
		const child = {
			closed: false,
			close: vi.fn(),
			document: childDocument,
		}
		vi.spyOn(window, 'open').mockReturnValue(child as unknown as Window)
		const player = createStatusMapRunPlayer(
			'Live run',
			[{ id: 'track-1', label: 'first behavior', spec: 'account.spec.ts:10', status: 'queued' }],
			{ onTogglePause: vi.fn(), onNext: vi.fn(), onPrev: vi.fn() },
		)
		const payload = 'x" onerror="globalThis.statusmapPwned=true'

		player?.setFrame(payload)

		const feed = childDocument.getElementById('feed')
		const image = feed?.querySelector('img')
		expect(feed?.children).toHaveLength(1)
		expect(image?.getAttribute('onerror')).toBeNull()
		expect(image?.getAttribute('src')).toBe(`data:image/jpeg;base64,${payload}`)
	})

	it('fires onSelect on a track-row click and previews a pending target', () => {
		const childDocument = document.implementation.createHTMLDocument('')
		const child = {
			closed: false,
			close: vi.fn(),
			document: childDocument,
		}
		vi.spyOn(window, 'open').mockReturnValue(child as unknown as Window)
		const onSelect = vi.fn()

		const player = createStatusMapRunPlayer(
			'Live run',
			[
				{ id: 'track-1', label: 'first behavior', spec: 'account.spec.ts:10', status: 'queued' },
				{ id: 'track-2', label: 'second behavior', spec: 'account.spec.ts:20', status: 'queued' },
			],
			{ onTogglePause: vi.fn(), onNext: vi.fn(), onPrev: vi.fn(), onSelect },
		)

		const row2 = childDocument.querySelector('[data-track="track-2"]') as HTMLElement
		row2.click()
		expect(onSelect).toHaveBeenCalledWith('track-2')

		player?.setPending('track-2')
		expect(row2.classList.contains('track--pending')).toBe(true)
		expect(childDocument.getElementById('progress')?.textContent).toBe('→ track 2 / 2 · switches after current')

		// Switching to the track clears the pending preview and marks it current.
		player?.setCurrent('track-2')
		expect(row2.classList.contains('track--pending')).toBe(false)
		expect(row2.classList.contains('track--current')).toBe(true)
	})
})
