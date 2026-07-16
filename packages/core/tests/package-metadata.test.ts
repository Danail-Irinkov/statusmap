import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
	exports: Record<string, unknown>
	files: string[]
	scripts: Record<string, string>
	repository?: { type?: string; url?: string; directory?: string }
	homepage?: string
	bugs?: { url?: string }
}

describe('package metadata', () => {
	it('only lists static package files that physically exist', () => {
		const generatedFiles = new Set(['dist'])
		const missingFiles = packageJson.files.filter(
			(file) => !generatedFiles.has(file) && !existsSync(join(packageRoot, file)),
		)

		expect(missingFiles).toEqual([])
	})

	it('exports the stylesheet while excluding it from the type-resolution audit', () => {
		expect(packageJson.exports['./styles.css']).toBe('./src/styles/statusmap.css')
		expect(packageJson.scripts['lint:pkg']).toContain('--exclude-entrypoints styles.css')
	})

	it('points package consumers back to the public repository', () => {
		expect(packageJson.repository).toEqual({
			type: 'git',
			url: 'git+https://github.com/Danail-Irinkov/statusmap.git',
			directory: 'packages/core',
		})
		expect(packageJson.homepage).toBe('https://github.com/Danail-Irinkov/statusmap#readme')
		expect(packageJson.bugs?.url).toBe('https://github.com/Danail-Irinkov/statusmap/issues')
	})
})
