import { describe, expect, it } from 'vitest'
import { refMatches, resultsForIntent, type RawTestResult } from '../src/index'

const result = (file: string, over: Partial<RawTestResult> = {}): RawTestResult => ({
	name: 'does a thing',
	file,
	suitePath: ['suite'],
	status: 'passed',
	...over,
})
const E2E = 'cypress/e2e/'

describe('refMatches — file tokens', () => {
	it('keeps the single-basename behaviour', () => {
		expect(refMatches('company-list.cy.js', result(`${E2E}Company/List/company-list.cy.js`))).toBe(true)
		expect(refMatches('other.cy.js', result(`${E2E}Company/List/company-list.cy.js`))).toBe(false)
	})

	it('matches a directory glob and ANY of several space-separated globs', () => {
		const ref = 'Company/List/*.cy.js Company/View/Sections/*.cy.js'
		expect(refMatches(ref, result(`${E2E}Company/List/company-list.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Company/View/Sections/company-details.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Company/View/company-view.cy.js`))).toBe(false)
	})

	it('matches comma-separated globs by their path suffix, at any depth under the test root', () => {
		const ref = 'Tabs/Contacts/*.cy.js, Tabs/Prospects/*.cy.js'
		expect(refMatches(ref, result(`${E2E}Company/View/Tabs/Contacts/x.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Company/View/Tabs/Prospects/y.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Company/View/Tabs/Deals/z.cy.js`))).toBe(false)
	})

	it('matches several comma-separated basenames', () => {
		const ref = 'company-merge-company-drawer.cy.js, company-quickbooks-drawer.cy.js'
		expect(refMatches(ref, result(`${E2E}Company/a/company-merge-company-drawer.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Company/b/company-quickbooks-drawer.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Company/b/company-other.cy.js`))).toBe(false)
	})

	it('expands {a,b} braces', () => {
		const ref = 'Order/View/order-items/{add-catalog,add-custom}.cy.js'
		expect(refMatches(ref, result(`${E2E}Order/View/order-items/add-catalog.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Order/View/order-items/add-custom.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Order/View/order-items/remove.cy.js`))).toBe(false)
	})

	it('treats ** as any depth, including zero directories', () => {
		const ref = 'Purchase/**/*.cy.js'
		expect(refMatches(ref, result(`${E2E}Purchase/po.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Purchase/List/Deep/po.cy.js`))).toBe(true)
		expect(refMatches(ref, result(`${E2E}Sales/po.cy.js`))).toBe(false)
	})

	it('anchors the glob on a path-segment boundary and keeps * inside one directory', () => {
		expect(refMatches('List/*.cy.js', result(`${E2E}Company/List/x.cy.js`))).toBe(true)
		expect(refMatches('List/*.cy.js', result(`${E2E}Company/SubList/x.cy.js`))).toBe(false)
		expect(refMatches('List/*.cy.js', result(`${E2E}Company/List/Deep/x.cy.js`))).toBe(false)
	})

	it('is case-insensitive and tolerates Windows separators in the result path', () => {
		expect(refMatches('company/list/*.CY.js', result('cypress\\e2e\\Company\\List\\x.cy.js'))).toBe(true)
	})

	it('keeps exact :line semantics on a file token', () => {
		const at = (line: number) => result(`${E2E}Company/company-list.cy.js`, { line })
		expect(refMatches('company-list.cy.js:12', at(12))).toBe(true)
		expect(refMatches('company-list.cy.js:12', at(13))).toBe(false)
		expect(refMatches('company-list.cy.js:12, other.cy.js', at(13))).toBe(false)
		expect(refMatches('company-list.cy.js:12, company-list.cy.js:13', at(13))).toBe(true)
	})
})

describe('refMatches — group tokens', () => {
	it('still requires every group token to appear in suitePath/name', () => {
		const r = result('harness/harness-matrix.spec.ts', { suitePath: ['multilingual_robustness'] })
		expect(refMatches('harness-matrix multilingual_robustness', r)).toBe(true)
		expect(refMatches('harness-matrix other_group', r)).toBe(false)
	})

	it('applies group tokens alongside glob file tokens', () => {
		const r = result(`${E2E}Company/List/x.cy.js`, { suitePath: ['batch actions'] })
		expect(refMatches('List/*.cy.js batch', r)).toBe(true)
		expect(refMatches('List/*.cy.js missing', r)).toBe(false)
	})

	it('matches nothing when the ref has only group tokens', () => {
		expect(refMatches('suite', result(`${E2E}Company/x.cy.js`))).toBe(false)
	})
})

describe('resultsForIntent with glob refs', () => {
	it('selects results owned by any file in the ref', () => {
		const all = [
			result(`${E2E}Company/List/a.cy.js`),
			result(`${E2E}Company/View/Sections/b.cy.js`),
			result(`${E2E}Company/View/c.cy.js`),
		]
		expect(resultsForIntent(all, ['Company/List/*.cy.js Company/View/Sections/*.cy.js']).map((r) => r.file)).toEqual([
			`${E2E}Company/List/a.cy.js`,
			`${E2E}Company/View/Sections/b.cy.js`,
		])
	})
})
