type TrackStatus = 'queued' | 'running' | 'passed' | 'failed'

export type StatusMapRunTrack = {
	id: string
	label: string
	spec: string
	status: TrackStatus
}

export type StatusMapRunPlayer = {
	closed: () => boolean
	close: () => void
	setFrame: (data: string) => void
	setTrackStatus: (id: string, status: TrackStatus) => void
	setCurrent: (id: string) => void
	// Preview the PENDING navigation target (a prev/next/click that applies once the current run ends).
	// Pass null to clear. Gives a click immediate visible feedback even while a run is mid-flight.
	setPending: (id: string | null) => void
	setPaused: (paused: boolean) => void
}

type PlayerCallbacks = {
	onTogglePause: () => void
	onNext: () => void
	onPrev: () => void
	// A track row was clicked — request a jump to it. Optional so older callers still type-check.
	onSelect?: (id: string) => void
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function trackMarkup(tracks: StatusMapRunTrack[]) {
	return tracks
		.map(
			(track, i) => `
				<li class="track track--${track.status}" data-track="${escapeHtml(track.id)}">
					<span class="track__mark">${i === 0 ? '▶' : '•'}</span>
					<span class="track__label">${escapeHtml(track.label)}</span>
					<span class="track__spec">${escapeHtml(track.spec)}</span>
					<span class="track__result"></span>
				</li>`,
		)
		.join('')
}

export function createStatusMapRunPlayer(
	title: string,
	tracks: StatusMapRunTrack[],
	callbacks: PlayerCallbacks,
): StatusMapRunPlayer | null {
	if (typeof window === 'undefined') return null
	const width = Math.round((window.screen?.availWidth || 1200) * 0.7)
	const height = Math.round((window.screen?.availHeight || 800) * 0.7)
	const left = Math.max(0, Math.round(((window.screen?.availWidth || width) - width) / 2))
	const top = Math.max(0, Math.round(((window.screen?.availHeight || height) - height) / 2))
	const child = window.open(
		'',
		'statusmap-run',
		`popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no`,
	)
	if (!child) return null

	child.document.open()
	child.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
	:root {
		--statusmap-page: #ffffff;
		--statusmap-card: #f8fafc;
		--statusmap-text: #0f172a;
		--statusmap-muted: #64748b;
		--statusmap-border: #e2e8f0;
		--statusmap-border-strong: #cbd5e1;
		--statusmap-done-dot: #16a34a;
		--statusmap-attention-dot: #f59e0b;
		--statusmap-problem-dot: #dc2626;
		--statusmap-neutral-bg: #f1f5f9;
		--statusmap-neutral-border: #cbd5e1;
		--statusmap-active-fg: #1e40af;
		--statusmap-active-bg: #dbeafe;
		--statusmap-active-border: #93c5fd;
		--statusmap-green-dot: var(--statusmap-done-dot);
		--statusmap-red-dot: var(--statusmap-problem-dot);
		--statusmap-yellow-dot: var(--statusmap-attention-dot);
		--statusmap-font-mono: ui-monospace, Menlo, Consolas, monospace;
	}
	* { box-sizing: border-box; }
	body {
		margin: 0;
		min-height: 100vh;
		background: var(--statusmap-card);
		color: var(--statusmap-text);
		font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	}
	.player { min-height: 100vh; display: flex; flex-direction: column; }
	.bar {
		display: flex; align-items: center; gap: 8px;
		padding: 8px 11px;
		background: var(--statusmap-neutral-bg);
		border-bottom: 1px solid var(--statusmap-border);
		font-family: var(--statusmap-font-mono);
		font-size: 11px;
	}
	.live {
		width: 8px; height: 8px; border-radius: 999px;
		background: var(--statusmap-red-dot);
		animation: pulse 1.1s infinite;
	}
	.title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.close {
		margin-left: auto; border: 0; background: transparent; color: var(--statusmap-muted);
		font: inherit; font-size: 18px; cursor: pointer; line-height: 1;
	}
	.feed {
		flex: 1 1 auto; min-height: 0;
		display: flex; align-items: center; justify-content: center;
		background-color: var(--statusmap-page);
		background-image: repeating-linear-gradient(45deg, var(--statusmap-page), var(--statusmap-page) 14px, var(--statusmap-neutral-bg) 14px, var(--statusmap-neutral-bg) 28px);
		color: var(--statusmap-muted);
		font-family: var(--statusmap-font-mono);
		text-align: center;
	}
	.feed img { display: block; width: 100%; height: 100%; object-fit: contain; }
	.tracks {
		flex: 0 0 auto; max-height: 32vh; overflow: auto;
		margin: 0; padding: 7px; list-style: none;
		border-top: 1px solid var(--statusmap-border);
		background: var(--statusmap-card);
	}
	.tracks__label {
		padding: 2px 8px 6px;
		color: var(--statusmap-muted);
		font-family: var(--statusmap-font-mono);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}
	.track {
		display: grid; grid-template-columns: 18px minmax(0, 1fr) auto auto;
		align-items: center; gap: 7px;
		padding: 5px 8px; border-radius: 7px;
		color: var(--statusmap-text);
		font-family: var(--statusmap-font-mono);
		font-size: 11.5px;
		cursor: pointer;
	}
	.track:hover { background: var(--statusmap-neutral-bg); }
	.track--current, .track--current:hover { background: var(--statusmap-active-bg); color: var(--statusmap-active-fg); }
	.track--pending { box-shadow: inset 0 0 0 1.5px var(--statusmap-active-border); }
	.track--passed .track__mark { color: var(--statusmap-green-dot); }
	.track--failed .track__mark { color: var(--statusmap-red-dot); }
	.track--running .track__mark { color: var(--statusmap-yellow-dot); animation: pulse 1s infinite; }
	.track__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.track__spec { color: var(--statusmap-muted); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.track__result { min-width: 4.5rem; font-weight: 700; text-align: right; }
	.track--passed .track__result { color: var(--statusmap-green-dot); }
	.track--failed .track__result { color: var(--statusmap-red-dot); }
	.controls {
		display: flex; align-items: center; justify-content: center; gap: 12px;
		padding: 9px;
		border-top: 1px solid var(--statusmap-border);
		background: var(--statusmap-neutral-bg);
	}
	.control {
		width: 36px; height: 31px;
		border: 1px solid var(--statusmap-border-strong); border-radius: 8px;
		background: var(--statusmap-page); color: var(--statusmap-text);
		cursor: pointer; font-size: 14px;
	}
	.control:hover { background: var(--statusmap-active-bg); color: var(--statusmap-active-fg); }
	.control--play { width: 42px; background: var(--statusmap-active-fg); border-color: var(--statusmap-active-fg); color: var(--statusmap-page); }
	.progress { min-width: 8rem; color: var(--statusmap-muted); font-family: var(--statusmap-font-mono); font-size: 11px; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
</style>
</head>
<body>
	<div class="player">
		<div class="bar"><span class="live"></span><span class="title">${escapeHtml(title)}</span><button class="close" type="button" aria-label="Close">×</button></div>
		<div class="feed" id="feed">Waiting for screencast frames</div>
		<ul class="tracks">
			<li class="tracks__label">Selected tracks · ${tracks.length}</li>
			${trackMarkup(tracks)}
		</ul>
		<div class="controls">
			<button class="control" id="prev" type="button" title="Previous track">⏮</button>
			<button class="control control--play" id="play" type="button" title="Play / pause">⏸</button>
			<button class="control" id="next" type="button" title="Next track">⏭</button>
			<span class="progress" id="progress">track 1 / ${tracks.length} · playing</span>
		</div>
	</div>
</body>
</html>`)
	child.document.close()

	child.document.querySelector('.close')?.addEventListener('click', () => child.close())
	child.document.getElementById('play')?.addEventListener('click', callbacks.onTogglePause)
	child.document.getElementById('next')?.addEventListener('click', callbacks.onNext)
	child.document.getElementById('prev')?.addEventListener('click', callbacks.onPrev)
	// Track rows are clickable — jump to a track (applied at the next run boundary; see runner-actions).
	child.document.querySelectorAll('.track').forEach((el) => {
		el.addEventListener('click', () => {
			const id = el.getAttribute('data-track')
			if (id) callbacks.onSelect?.(id)
		})
	})

	let current = tracks[0]?.id || ''
	let paused = false
	let pending = '' // a queued nav target (prev/next/click) awaiting the current run's boundary; '' = none
	const statuses = new Map(tracks.map((track) => [track.id, track.status]))

	const renderProgress = () => {
		const progress = child.document.getElementById('progress')
		if (!progress) return
		if (pending) {
			const p = Math.max(0, tracks.findIndex((track) => track.id === pending))
			progress.textContent = `→ track ${p + 1} / ${tracks.length} · switches after current`
		} else {
			const index = Math.max(0, tracks.findIndex((track) => track.id === current))
			const status = statuses.get(current)
			const state = status === 'passed' ? 'passed' : status === 'failed' ? 'failed' : paused ? 'paused' : 'playing'
			progress.textContent = `track ${index + 1} / ${tracks.length} · ${state}`
		}
		const play = child.document.getElementById('play')
		if (play) play.textContent = paused ? '▶' : '⏸'
	}
	const markCurrent = () => {
		pending = ''
		const rows = [...child.document.querySelectorAll('.track')]
		rows.forEach((el) => el.classList.remove('track--current', 'track--pending'))
		const cur = rows.find((el) => el.getAttribute('data-track') === current)
		cur?.classList.add('track--current')
		try {
			cur?.scrollIntoView({ block: 'nearest' })
		} catch {
			/* jsdom / older engines may lack scrollIntoView — best-effort */
		}
		renderProgress()
	}
	markCurrent()

	return {
		closed: () => child.closed,
		close: () => child.close(),
		setFrame: (data: string) => {
			if (child.closed) return
			const feed = child.document.getElementById('feed')
			if (!feed) return
			const image = child.document.createElement('img')
			image.alt = 'Live browser frame'
			image.src = `data:image/jpeg;base64,${data}`
			feed.replaceChildren(image)
		},
		setTrackStatus: (id: string, status: TrackStatus) => {
			if (child.closed) return
			const el = [...child.document.querySelectorAll('.track')].find((node) => node.getAttribute('data-track') === id)
			if (!el) return
			el.classList.remove('track--queued', 'track--running', 'track--passed', 'track--failed')
			el.classList.add(`track--${status}`)
			const mark = el.querySelector('.track__mark')
			if (mark) mark.textContent = status === 'passed' ? '✓' : status === 'failed' ? '✗' : status === 'running' ? '▶' : '•'
			const result = el.querySelector('.track__result')
			if (result) result.textContent = status === 'passed' ? '✓ passed' : status === 'failed' ? '✗ failed' : ''
			statuses.set(id, status)
			renderProgress()
		},
		setCurrent: (id: string) => {
			current = id
			markCurrent()
		},
		setPending: (id: string | null) => {
			if (child.closed) return
			pending = id || ''
			const rows = [...child.document.querySelectorAll('.track')]
			rows.forEach((el) => el.classList.remove('track--pending'))
			if (id) {
				const el = rows.find((node) => node.getAttribute('data-track') === id)
				el?.classList.add('track--pending')
				try {
					el?.scrollIntoView({ block: 'nearest' })
				} catch {
					/* best-effort */
				}
			}
			renderProgress()
		},
		setPaused: (value: boolean) => {
			paused = value
			renderProgress()
		},
	}
}
