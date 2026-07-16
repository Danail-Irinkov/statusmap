import { describe, it, expect } from 'vitest'
import {
	activeCount,
	clearFilter,
	filterFromQuery,
	filterToQuery,
	isFilterActive,
	isValueActive,
	NEEDS_ATTENTION_TONES,
	setText,
	toggleGroup,
	toggleValue,
	type StatusMapFilterState,
} from '../src/index'

describe('toggleValue — pure, immutable transitions', () => {
	it('adds a value to an empty group without mutating the input', () => {
		const before: StatusMapFilterState = {}
		const after = toggleValue(before, 'tones', 'red')
		expect(after).not.toBe(before)
		expect(before).toEqual({}) // input untouched
		expect(after.tones).toEqual(['red'])
	})
	it('removes a present value and drops an emptied group (canonical form)', () => {
		const after = toggleValue({ tones: ['red'] }, 'tones', 'red')
		expect(after.tones).toBeUndefined() // emptied group is removed, not left as []
		expect(after).toEqual({})
	})
	it('toggles independently per group', () => {
		let s: StatusMapFilterState = {}
		s = toggleValue(s, 'tones', 'red')
		s = toggleValue(s, 'verdicts', 'failing')
		s = toggleValue(s, 'areas', 'a1')
		expect(s).toEqual({ tones: ['red'], verdicts: ['failing'], areas: ['a1'] })
	})
	it('does not duplicate when toggling distinct values into a group', () => {
		let s: StatusMapFilterState = {}
		s = toggleValue(s, 'tones', 'red')
		s = toggleValue(s, 'tones', 'yellow')
		expect(s.tones).toEqual(['red', 'yellow'])
	})
})

describe('toggleGroup — set-wise toggle of a preset', () => {
	it('adds all values when none/some are present', () => {
		const s = toggleGroup({}, 'tones', NEEDS_ATTENTION_TONES)
		expect(s.tones).toEqual(NEEDS_ATTENTION_TONES)
	})
	it('removes the whole set when every value is already present', () => {
		const on = toggleGroup({}, 'tones', NEEDS_ATTENTION_TONES)
		const off = toggleGroup(on, 'tones', NEEDS_ATTENTION_TONES)
		expect(off.tones).toBeUndefined()
		expect(off).toEqual({})
	})
	it('adds only the missing values when partially present, without duplicating', () => {
		const s = toggleGroup({ tones: ['red'] }, 'tones', ['red', 'yellow'])
		expect(s.tones).toEqual(['red', 'yellow'])
	})
	it('does not mutate the input', () => {
		const before: StatusMapFilterState = { tones: ['red'] }
		toggleGroup(before, 'tones', ['yellow'])
		expect(before).toEqual({ tones: ['red'] })
	})
})

describe('setText — set/clear the free-text dimension', () => {
	it('sets non-blank text', () => {
		expect(setText({}, 'notes').text).toBe('notes')
	})
	it('blank/whitespace clears it', () => {
		expect(setText({ text: 'old' }, '').text).toBeUndefined()
		expect(setText({ text: 'old' }, '   ').text).toBeUndefined()
	})
	it('does not mutate the input', () => {
		const before: StatusMapFilterState = { text: 'old' }
		setText(before, 'new')
		expect(before.text).toBe('old')
	})
})

describe('clearFilter', () => {
	it('returns the inactive (empty) state', () => {
		expect(clearFilter()).toEqual({})
		expect(isFilterActive(clearFilter())).toBe(false)
	})
})

describe('selectors', () => {
	const s: StatusMapFilterState = {
		tones: ['red', 'yellow'],
		verdicts: ['failing'],
		areas: ['a1'],
		text: 'notes',
	}
	it('isValueActive reflects membership', () => {
		expect(isValueActive(s, 'tones', 'red')).toBe(true)
		expect(isValueActive(s, 'tones', 'green')).toBe(false)
		expect(isValueActive(s, 'verdicts', 'failing')).toBe(true)
		expect(isValueActive(s, 'areas', 'a1')).toBe(true)
		expect(isValueActive({}, 'tones', 'red')).toBe(false)
	})
	it('activeCount sums tones + verdicts + areas + (1 if text)', () => {
		expect(activeCount(s)).toBe(2 + 1 + 1 + 1) // 5
		expect(activeCount({})).toBe(0)
		expect(activeCount({ tones: ['red'] })).toBe(1)
		expect(activeCount({ text: '  ' })).toBe(0) // blank text does not count
		expect(activeCount({ statuses: ['red', 'yellow'] })).toBe(2) // legacy alias counted
	})
	it('isFilterActive agrees with activeCount > 0', () => {
		expect(isFilterActive(s)).toBe(true)
		expect(isFilterActive({})).toBe(false)
	})
})

describe('URL codec — filterToQuery / filterFromQuery', () => {
	it('writes only non-empty dimensions with the documented keys', () => {
		const q = filterToQuery({ tones: ['red', 'blocked'], verdicts: ['failing'], text: 'note search' })
		expect(q.get('tones')).toBe('red,blocked')
		expect(q.get('verdicts')).toBe('failing')
		expect(q.get('q')).toBe('note search')
		expect(q.get('areas')).toBeNull() // empty dimension omitted
	})
	it('an inactive state yields no params', () => {
		expect(filterToQuery({}).toString()).toBe('')
		expect(filterToQuery({ tones: [], text: '  ' }).toString()).toBe('')
	})
	it('parses a query string, ignoring unknown keys (view/area/feature co-exist)', () => {
		const state = filterFromQuery('view=flat&tones=red,yellow&verdicts=failing&q=notes&area=a1')
		expect(state).toEqual({ tones: ['red', 'yellow'], verdicts: ['failing'], text: 'notes' })
	})
	it('accepts a plain record and a URLSearchParams alike', () => {
		expect(filterFromQuery({ tones: 'red', q: 'x' })).toEqual({ tones: ['red'], text: 'x' })
		expect(filterFromQuery(new URLSearchParams('areas=a1,a2'))).toEqual({ areas: ['a1', 'a2'] })
	})

	// The headline guarantee: filterToQuery ∘ filterFromQuery === identity over canonical states.
	const roundTrips: StatusMapFilterState[] = [
		{},
		{ tones: ['red'] },
		{ verdicts: ['failing', 'blocked'] },
		{ areas: ['a1', 'a2'] },
		{ text: 'free text search' },
		{ tones: ['red', 'blocked'], verdicts: ['failing'], areas: ['core'], text: 'note' },
		{ tones: NEEDS_ATTENTION_TONES },
	]
	it.each(roundTrips)('round-trips %j to an identical state', (state) => {
		const back = filterFromQuery(filterToQuery(state))
		expect(back).toEqual(state)
	})

	it('round-trips a STRING form too (toString → parse)', () => {
		const state: StatusMapFilterState = { tones: ['red'], verdicts: ['failing'], text: 'q text' }
		const back = filterFromQuery(filterToQuery(state).toString())
		expect(back).toEqual(state)
	})

	it('trims whitespace in list values and the text on parse', () => {
		expect(filterFromQuery('tones= red , yellow &q=  hi  ')).toEqual({
			tones: ['red', 'yellow'],
			text: 'hi',
		})
	})
})
