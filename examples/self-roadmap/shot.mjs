// Render-proof for the self-roadmap demo: the statusmap library rendering the framework's OWN roadmap,
// QA-first (one plain status per capability + a "what works now" tally).
// Start the demo first:  node node_modules/vite/bin/vite.js --config demo/vite.config.mjs demo  (from packages/vue)
// then:                  node examples/self-roadmap/shot.mjs  (from the statusmap root)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The synthetic Acme ledger is the public default; this proof explicitly opens the dog-food route.
const base = process.env.DEMO_URL || 'http://localhost:4317/?demo=self'
const out = fileURLToPath(new URL('../../shots', import.meta.url))
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
try {
	for (const [w, h, tag] of [
		[1440, 1600, '1440'],
		[390, 2000, '390'],
	]) {
		const page = await browser.newPage({ viewport: { width: w, height: h } })
		await page.goto(base, { waitUntil: 'networkidle' })
		await page.getByText('What works now').first().waitFor({ timeout: 30000 })
		await page.screenshot({ path: `${out}/self-roadmap-qa-${tag}.png`, fullPage: true })
		console.log('shot:', tag)
		await page.close()
	}
} finally {
	await browser.close()
}
console.log('done ->', out)
