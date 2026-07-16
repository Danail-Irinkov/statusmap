import { describe, expect, it } from 'vitest'
import * as publicApi from '../src/index'

describe('stable public API', () => {
	it('exports the supported v0.1 surface without unfinished schema runtimes', () => {
		expect(publicApi.createStatusMap).toBeTypeOf('function')
		expect(publicApi.filterLedger).toBeTypeOf('function')
		expect(publicApi.buildTestResults).toBeTypeOf('function')

		expect('applySignals' in publicApi).toBe(false)
		expect('snapshot' in publicApi).toBe(false)
		expect('BANNED_AUTHORED_FIELDS' in publicApi).toBe(false)
	})
})
