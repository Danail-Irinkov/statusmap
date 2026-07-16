// Rendered release proof for the public <StatusMap :files> path. Serve the demo first, then run this file.
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const url = process.env.DEMO_URL || 'http://localhost:4317/'
const out = process.env.STATUSMAP_SHOT_DIR || fileURLToPath(new URL('../../shots', import.meta.url))
const report = []
const failures = []

async function capture(browser, options) {
	const {
		name,
		width = 1440,
		height = 1200,
		colorScheme = 'light',
		reducedMotion = 'no-preference',
		targetUrl = url,
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
		await page.emulateMedia({ colorScheme, reducedMotion })
		await page.goto(targetUrl, { waitUntil: 'networkidle' })
		await page.waitForSelector('.status-explorer__filter')
		if (setup) await setup(page)
		await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })

		const axe = await new AxeBuilder({ page }).analyze()
		const serious = axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''))
		const geometry = await page.evaluate(() => ({
			viewportWidth: window.innerWidth,
			scrollWidth: document.documentElement.scrollWidth,
			overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
		}))
		const state = {
			name,
			targetUrl,
			width,
			colorScheme,
			reducedMotion,
			geometry,
			consoleErrors,
			pageErrors,
			axe: axe.violations.map((violation) => ({
				id: violation.id,
				impact: violation.impact,
				nodes: violation.nodes.length,
			})),
		}
		report.push(state)
		if (geometry.overflow) failures.push(`${name}: horizontal overflow (${geometry.scrollWidth} > ${geometry.viewportWidth})`)
		if (consoleErrors.length) failures.push(`${name}: ${consoleErrors.length} console error(s)`)
		if (pageErrors.length) failures.push(`${name}: ${pageErrors.length} page error(s)`)
		if (serious.length) failures.push(`${name}: serious axe violations: ${serious.map((item) => item.id).join(', ')}`)
	} finally {
		await context.close()
	}
}

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
try {
	for (const width of [390, 768, 1440]) {
		for (const colorScheme of ['light', 'dark']) {
			await capture(browser, { name: `sm-${width}-${colorScheme}-overview`, width, colorScheme })
		}
	}

	await capture(browser, {
		name: 'sm-1440-light-filtered',
		setup: async (page) => {
			await page.getByRole('button', { name: 'Needs attention' }).first().click()
			await page.waitForTimeout(150)
		},
	})
	await capture(browser, {
		name: 'sm-1440-light-no-match',
		setup: async (page) => {
			await page.getByRole('searchbox', { name: 'Filter the map by text' }).fill('does-not-exist')
			await page.getByRole('heading', { name: 'No matches' }).waitFor()
		},
	})
	await capture(browser, {
		name: 'sm-1440-light-feature',
		setup: async (page) => {
			await page.locator('a.status-map-flow__node', { hasText: 'Sync' }).first().click()
			await page.locator('a.status-map-flow__node', { hasText: 'Offline' }).first().click()
			const failing = page.locator('summary.status-map-cards__summary', { hasText: 'Replay' }).first()
			if (await failing.count()) await failing.click()
		},
	})
	for (const [index, label] of [[0, 'grouped'], [1, 'list']]) {
		await capture(browser, {
			name: `sm-1440-dark-focus-${label}`,
			colorScheme: 'dark',
			setup: async (page) => {
				const view = page.locator('.status-explorer__view').nth(index)
				await view.focus()
				const focusVisible = await view.evaluate((element) => element.matches(':focus-visible'))
				if (!focusVisible) failures.push(`sm-1440-dark-focus-${label}: :focus-visible did not match`)
			},
		})
	}
	await capture(browser, {
		name: 'sm-1440-light-list',
		setup: async (page) => {
			await page.getByRole('link', { name: 'List' }).click()
			await page.getByRole('heading', { name: 'Acme — Status map (All)' }).waitFor()
		},
	})
	await capture(browser, {
		name: 'sm-390-dark-reduced-motion',
		width: 390,
		colorScheme: 'dark',
		reducedMotion: 'reduce',
		setup: async (page) => {
			const motion = await page.locator('.status-map-flow__node--link').first().evaluate((element) => {
				const style = getComputedStyle(element)
				return { transitionDuration: style.transitionDuration, transform: style.transform }
			})
			if (motion.transitionDuration !== '0s' || motion.transform !== 'none') {
				failures.push(`sm-390-dark-reduced-motion: ${JSON.stringify(motion)}`)
			}
		},
	})
	const selfExploreUrl = new URL('?demo=self&view=explore', url).href
	await capture(browser, {
		name: 'sm-390-light-self-roadmap',
		width: 390,
		targetUrl: selfExploreUrl,
	})
	await capture(browser, {
		name: 'sm-390-dark-self-roadmap',
		width: 390,
		colorScheme: 'dark',
		targetUrl: selfExploreUrl,
	})
} finally {
	await browser.close()
}

await writeFile(`${out}/report.json`, `${JSON.stringify({ url, report, failures }, null, 2)}\n`)
if (failures.length) throw new Error(`Rendered proof failed:\n- ${failures.join('\n- ')}`)
console.log(`OK — ${report.length} rendered states passed axe, console, and overflow checks in ${out}`)
