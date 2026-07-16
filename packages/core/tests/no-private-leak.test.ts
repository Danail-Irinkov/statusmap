import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const guard = fileURLToPath(new URL('../../../scripts/check-public-leaks.mjs', import.meta.url))

describe('public-tree leak guard', () => {
	it('keeps private identifiers, local paths, email addresses, and secrets out of tracked text', () => {
		const output = execFileSync(process.execPath, [guard], { cwd: repoRoot, encoding: 'utf8' })
		expect(output).toContain('Public-tree leak guard passed')
	})

	it('detects private identifiers, local paths, and npm publication credentials', async () => {
		// @ts-expect-error The release guard is a repository-level JavaScript module, not a package API.
		const { findPublicLeaks } = await import('../../../scripts/public-leak-rules.mjs') as {
			findPublicLeaks: (file: string, content: string) => string[]
		}
		const npmToken = ['npm_', 'a'.repeat(36)].join('')
		const cases = [
			{ value: ['ko', 've'].join(''), label: 'known private identifier' },
			{ value: ['D:', '\\code', '\\private'].join(''), label: 'local machine path' },
			{ value: npmToken, label: 'npm access token' },
			{ value: `//registry.npmjs.org/:_authToken=${npmToken}`, label: 'npm auth assignment' },
		]

		for (const fixture of cases) {
			expect(findPublicLeaks('fixture.txt', fixture.value).some((finding) => finding.includes(fixture.label))).toBe(true)
		}
	})
})
