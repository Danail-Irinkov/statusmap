import type { Ledger } from '@statusmap/core'

// A representative demo ledger (fictional "Acme Notes") — varied lifecycles, proof levels, a failing +
// blocked intent, and gaps, so the review filter has something real to filter.
export const demoLedger: Ledger = {
	generatedAt: '2026-06-22T10:00:00.000Z',
	areas: [
		{ id: 'core', label: 'Core', order: 1, summary: 'The editor and search.' },
		{ id: 'sync', label: 'Sync & offline', order: 2, summary: 'Consistency across devices.' },
		{ id: 'billing', label: 'Billing', order: 3, summary: 'Plans and invoices.' },
	],
	features: [
		{
			id: 'editor',
			label: 'Note editor',
			areaId: 'core',
			lifecycle: 'live',
			summary: 'Write and format notes with autosave.',
			prd: ['EDITOR_SPEC'],
			intents: [
				{
					id: 'write',
					label: 'Write & autosave a note',
					lifecycle: 'live',
					coverage: { proofLevel: 'destination', passing: true, owningE2e: 'editor-autosave', lastRun: '2026-06-20' },
				},
			],
		},
		{
			id: 'search',
			label: 'Full-text search',
			areaId: 'core',
			lifecycle: 'built',
			summary: 'Find notes by keyword.',
			prd: ['SEARCH_SPEC'],
			intents: [
				{
					id: 'kw',
					label: 'Search notes by keyword',
					lifecycle: 'built',
					note: 'Works, but relevance ranking is only spot-checked.',
					coverage: { proofLevel: 'heuristic', passing: true, matrix: 'search-relevance-matrix', lastRun: '2026-06-18' },
				},
			],
			gaps: ['Is fuzzy matching in scope for v1?'],
		},
		{
			id: 'offline',
			label: 'Offline sync',
			areaId: 'sync',
			lifecycle: 'partial',
			summary: 'Edit offline and reconcile on reconnect.',
			prd: ['SYNC_SPEC'],
			intents: [
				{
					id: 'queue',
					label: 'Queue edits made while offline',
					lifecycle: 'built',
					coverage: { proofLevel: 'unit', passing: true, lastRun: '2026-06-17' },
				},
				{
					id: 'replay',
					label: 'Replay queued edits on reconnect',
					lifecycle: 'partial',
					health: 'down',
					note: 'Replay drops edits when the queue is large.',
					coverage: {
						proofLevel: 'owning_e2e',
						passing: false,
						owningE2e: 'offline-replay',
						lastRun: '2026-06-19',
						testTree: [
							{
								name: 'replay queued edits',
								status: 'failed',
								counts: { passed: 1, failed: 1, skipped: 0 },
								children: [
									{ name: 'POST /replay returns 500', status: 'failed', counts: { passed: 0, failed: 1, skipped: 0 } },
									{ name: 'retries after refresh', status: 'passed', counts: { passed: 1, failed: 0, skipped: 0 } },
								],
							},
						],
					},
					workflows: [
						{ id: 'detect', label: 'Detect reconnect', lifecycle: 'live' },
						{ id: 'flush', label: 'Flush the edit queue', lifecycle: 'partial', health: 'down', note: 'Large queues exceed the request size limit.' },
					],
				},
			],
			gaps: ['What is the maximum offline queue size we support?'],
		},
		{
			id: 'conflict',
			label: 'Conflict resolution',
			areaId: 'sync',
			lifecycle: 'planned',
			summary: 'Merge concurrent edits from two devices.',
			prd: ['SYNC_SPEC'],
			intents: [
				{
					id: 'merge',
					label: 'Three-way merge concurrent edits',
					lifecycle: 'not_built',
					coverage: { proofLevel: 'none', passing: false },
				},
			],
			gaps: ['Auto-merge or always ask the user?'],
		},
		{
			id: 'subs',
			label: 'Subscriptions',
			areaId: 'billing',
			lifecycle: 'beta',
			summary: 'Subscribe to a paid plan.',
			prd: ['BILLING_SPEC'],
			intents: [
				{
					id: 'subscribe',
					label: 'Subscribe to a plan',
					lifecycle: 'beta',
					coverage: { proofLevel: 'owning_e2e', passing: true, owningE2e: 'billing-subscribe', lastRun: '2026-06-15' },
				},
			],
		},
		{
			id: 'invoices',
			label: 'Invoice history',
			areaId: 'billing',
			lifecycle: 'deferred',
			summary: 'Download past invoices as PDFs.',
			prd: ['BILLING_SPEC'],
			gaps: ['Deferred until subscriptions exit beta.'],
		},
	],
}
