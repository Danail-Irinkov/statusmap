// Deterministic README screenshots for the public package pages. Serve the demo first.
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const url = process.env.DEMO_URL || 'http://localhost:4317/'
const out = process.env.STATUSMAP_README_SHOT_DIR
	|| fileURLToPath(new URL('../../docs/images', import.meta.url))
const failures = []

async function capture(browser, options) {
	const {
		name,
		width,
		height,
		colorScheme = 'light',
		setup,
	} = options
	const context = await browser.newContext({ viewport: { width, height } })
	const page = await context.newPage()
	const consoleErrors = []
	const pageErrors = []
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text())
	})
	page.on('pageerror', (error) => pageErrors.push(error.message))

	try {
		await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
		await page.goto(url, { waitUntil: 'networkidle' })
		await page.waitForSelector('.status-explorer__filter')
		if (setup) await setup(page)

		const geometry = await page.evaluate(() => ({
			viewportWidth: window.innerWidth,
			scrollWidth: document.documentElement.scrollWidth,
		}))
		if (geometry.scrollWidth > geometry.viewportWidth + 1) {
			failures.push(`${name}: horizontal overflow (${geometry.scrollWidth} > ${geometry.viewportWidth})`)
		}

		const axe = await new AxeBuilder({ page }).analyze()
		const serious = axe.violations.filter((violation) =>
			['serious', 'critical'].includes(violation.impact || ''),
		)
		if (serious.length) {
			failures.push(`${name}: serious axe violations: ${serious.map((item) => item.id).join(', ')}`)
		}
		if (consoleErrors.length) failures.push(`${name}: ${consoleErrors.length} console error(s)`)
		if (pageErrors.length) failures.push(`${name}: ${pageErrors.length} page error(s)`)

		await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
	} finally {
		await context.close()
	}
}

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
try {
	await capture(browser, {
		name: 'statusmap-overview',
		width: 1200,
		height: 720,
	})
	await capture(browser, {
		name: 'statusmap-feature-proof',
		width: 1200,
		height: 1100,
		setup: async (page) => {
			await page.locator('a.status-map-flow__node', { hasText: 'Sync' }).first().click()
			await page.locator('a.status-map-flow__node', { hasText: 'Offline' }).first().click()
			const failing = page.locator('summary.status-map-cards__summary', { hasText: 'Replay' }).first()
			if (await failing.count()) await failing.click()
		},
	})
	await capture(browser, {
		name: 'statusmap-mobile-dark',
		width: 390,
		height: 1100,
		colorScheme: 'dark',
	})
} finally {
	await browser.close()
}

if (failures.length) throw new Error(`README screenshot proof failed:\n- ${failures.join('\n- ')}`)
console.log(`OK — README screenshots passed accessibility, console, and overflow checks in ${out}`)
