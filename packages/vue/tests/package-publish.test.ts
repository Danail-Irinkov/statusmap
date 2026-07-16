import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
	dependencies: Record<string, string>
	devDependencies: Record<string, string>
	exports: Record<string, unknown>
	files: string[]
	peerDependencies: Record<string, string>
	scripts: Record<string, string>
	types?: string
	repository?: { type?: string; url?: string; directory?: string }
	homepage?: string
	bugs?: { url?: string }
}

describe('package publish metadata', () => {
	it('uses @statusmap/core as a public peer and a local dev dependency', () => {
		expect(packageJson.dependencies['@statusmap/core']).toBeUndefined()
		expect(packageJson.peerDependencies['@statusmap/core']).toBe('^0.1.0')
		expect(packageJson.devDependencies['@statusmap/core']).toBe('file:../core')
	})

	it('ships package-local release metadata', () => {
		expect(packageJson.files).toContain('LICENSE')
		expect(packageJson.files).toContain('CHANGELOG.md')
		expect(packageJson.files).toContain('dist')
		expect(existsSync(resolve(packageRoot, 'LICENSE'))).toBe(true)
		expect(existsSync(resolve(packageRoot, 'CHANGELOG.md'))).toBe(true)
	})

	it('keeps source runtime exports while shipping generated declarations', () => {
		expect(packageJson.types).toBe('./dist/index.d.ts')
		expect(packageJson.exports['.']).toMatchObject({
			types: './dist/index.d.ts',
			import: './src/index.ts',
		})
		expect(packageJson.scripts['build:types']).toContain('vue-tsc')
		expect(packageJson.scripts['prepack']).toContain('build:types')
		expect(packageJson.scripts['lint:pkg']).toContain('publint')
		expect(packageJson.scripts['lint:pkg']).toContain('--profile esm-only')
		expect(packageJson.scripts['pack:dry']).toBe('npm pack --dry-run')
	})

	it('points package consumers back to the public repository', () => {
		expect(packageJson.repository).toEqual({
			type: 'git',
			url: 'git+https://github.com/Danail-Irinkov/statusmap.git',
			directory: 'packages/vue',
		})
		expect(packageJson.homepage).toBe('https://github.com/Danail-Irinkov/statusmap#readme')
		expect(packageJson.bugs?.url).toBe('https://github.com/Danail-Irinkov/statusmap/issues')
	})
})
