import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPublicLeaks } from './public-leak-rules.mjs'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const scratchRoot = resolve(process.env.STATUSMAP_TMP_DIR || join(repoRoot, '.tmp'))
mkdirSync(scratchRoot, { recursive: true })
const workRoot = mkdtempSync(join(scratchRoot, 'packed-consumer-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(args, cwd, options = {}) {
	return execFileSync(npm, args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: process.platform === 'win32',
		windowsHide: true,
		...options,
	})
}

function runNode(script, cwd) {
	return execFileSync(process.execPath, [script], {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	})
}

function write(path, content) {
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(path, content)
}

function pack(packageRoot, destination) {
	const output = run(['pack', '--silent', '--json', '--pack-destination', destination], packageRoot)
	const starts = [...output.matchAll(/\[\s*\{\s*"id"\s*:/g)]
	const jsonStart = starts.at(-1)?.index
	if (jsonStart === undefined) throw new Error(`Could not find npm pack JSON in output: ${output}`)
	const result = JSON.parse(output.slice(jsonStart))
	if (!Array.isArray(result) || !result[0]?.filename) throw new Error(`Unexpected npm pack output: ${output}`)
	return {
		tarball: resolve(destination, result[0].filename),
		files: result[0].files.map((file) => file.path),
	}
}

function assertPackageManifest(label, files, allowed, required) {
	const unexpected = files.filter((path) => !allowed(path))
	const missing = required.filter((path) => !files.includes(path))
	if (unexpected.length || missing.length) {
		throw new Error(`${label} packed manifest mismatch:\nunexpected: ${unexpected.join(', ') || 'none'}\nmissing: ${missing.join(', ') || 'none'}`)
	}
}

function assertInstalledFromFixture(fixture, specifier) {
	const requireFromFixture = createRequire(join(fixture, 'package.json'))
	const packageJson = realpathSync(requireFromFixture.resolve(`${specifier}/package.json`))
	const installedRoot = `${realpathSync(join(fixture, 'node_modules'))}${sep}`
	if (!packageJson.startsWith(installedRoot)) {
		throw new Error(`${specifier} resolved outside the packed fixture: ${packageJson}`)
	}
	return dirname(packageJson)
}

function scanPackedTree(root) {
	const textExtensions = new Set(['', '.css', '.html', '.js', '.json', '.map', '.md', '.mjs', '.ts', '.vue', '.yaml', '.yml'])
	const offenders = []
	const walk = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name)
			if (entry.isDirectory()) walk(path)
			else if (textExtensions.has(extname(path).toLowerCase())) {
				offenders.push(...findPublicLeaks(relative(root, path), readFileSync(path, 'utf8')))
			}
		}
	}
	walk(root)
	if (offenders.length) throw new Error(`Packed package leak guard failed:\n${offenders.join('\n')}`)
}

try {
	const tarballs = join(workRoot, 'tarballs')
	const fixture = join(workRoot, 'fixture')
	mkdirSync(tarballs, { recursive: true })

	const corePack = pack(join(repoRoot, 'packages', 'core'), tarballs)
	const vuePack = pack(join(repoRoot, 'packages', 'vue'), tarballs)
	assertPackageManifest(
		'@statusmap/core',
		corePack.files,
		(path) => ['CHANGELOG.md', 'LICENSE', 'README.md', 'package.json', 'src/styles/statusmap.css'].includes(path) || /^dist\/index\.(?:cjs|mjs|d\.(?:cts|mts))(?:\.map)?$/.test(path),
		['package.json', 'dist/index.cjs', 'dist/index.mjs', 'dist/index.d.cts', 'dist/index.d.mts', 'src/styles/statusmap.css'],
	)
	assertPackageManifest(
		'@statusmap/vue',
		vuePack.files,
		(path) => ['CHANGELOG.md', 'LICENSE', 'README.md', 'package.json', 'src/styles/statusmap.css'].includes(path) || /^dist\/[A-Za-z0-9.-]+\.d\.ts$/.test(path) || /^src\/[A-Za-z0-9.-]+\.(?:ts|vue)$/.test(path),
		['package.json', 'dist/index.d.ts', 'src/index.ts', 'src/StatusMap.vue', 'src/styles/statusmap.css'],
	)
	const coreTarball = corePack.tarball
	const vueTarball = vuePack.tarball
	const fileDependency = (path) => `file:${path.replaceAll('\\', '/')}`

	write(join(fixture, 'package.json'), JSON.stringify({
		private: true,
		type: 'module',
		scripts: { build: 'vite build' },
		dependencies: {
			'@statusmap/core': fileDependency(coreTarball),
			'@statusmap/vue': fileDependency(vueTarball),
			vue: '^3.5.0',
		},
		devDependencies: {
			'@vitejs/plugin-vue': 'latest',
			typescript: 'latest',
			vite: 'latest',
		},
	}, null, 2))
	write(join(fixture, 'index.html'), '<main id="app"></main><script type="module" src="/src/main.ts"></script>\n')
	write(join(fixture, 'vite.config.ts'), "import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\nexport default defineConfig({ plugins: [vue()] })\n")
	write(join(fixture, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
		target: 'ES2022',
		module: 'ESNext',
		moduleResolution: 'Bundler',
		strict: true,
		skipLibCheck: true,
	}, include: ['src', 'vite.config.ts'] }, null, 2))
	write(join(fixture, 'src', 'main.ts'), "import { createApp } from 'vue'\nimport App from './App.vue'\nimport '@statusmap/vue/styles.css'\ncreateApp(App).mount('#app')\n")
	write(join(fixture, 'src', 'App.vue'), `<script setup lang="ts">
import { StatusMap } from '@statusmap/vue'
import { createStatusMap } from '@statusmap/core'

const files = {
  '/status/areas.yaml': 'areas:\\n  - id: core\\n    label: Core',
  '/status/features/core/search.yaml': 'id: search\\nareaId: core\\nlabel: Search\\nlifecycle: live\\nintents:\\n  - id: find\\n    label: Find a note\\n    lifecycle: live',
}
const { ledger } = createStatusMap(files, (source) => {
  if (source.includes('areas:')) return { areas: [{ id: 'core', label: 'Core' }] }
  return { id: 'search', areaId: 'core', label: 'Search', lifecycle: 'live', intents: [{ id: 'find', label: 'Find a note', lifecycle: 'live' }] }
})
</script>

<template><StatusMap :ledger="ledger" brand="Packed consumer" /></template>
`)

	run(['install', '--ignore-scripts', '--no-fund', '--no-audit'], fixture)
	const coreInstall = assertInstalledFromFixture(fixture, '@statusmap/core')
	const vueInstall = assertInstalledFromFixture(fixture, '@statusmap/vue')
	scanPackedTree(coreInstall)
	scanPackedTree(vueInstall)
	if (!existsSync(join(vueInstall, 'dist', 'index.d.ts'))) throw new Error('Packed Vue declarations are missing.')
	if (!existsSync(join(coreInstall, 'dist', 'index.mjs'))) throw new Error('Packed core runtime is missing.')
	write(join(fixture, 'verify-core-esm.mjs'), `import { createStatusMap, filterLedger, buildTestResults } from '@statusmap/core'
for (const [name, value] of Object.entries({ createStatusMap, filterLedger, buildTestResults })) {
  if (typeof value !== 'function') throw new Error(\`Missing ESM runtime export: \${name}\`)
}
const files = {
  '/status/areas.yaml': 'areas',
  '/status/features/core/search.yaml': 'feature',
}
const { ledger } = createStatusMap(files, (source) => source === 'areas'
  ? [{ id: 'core', label: 'Core' }]
  : { id: 'search', areaId: 'core', label: 'Search', lifecycle: 'live' })
if (ledger.features[0]?.id !== 'search') throw new Error('ESM createStatusMap did not execute correctly')
`)
	write(join(fixture, 'verify-core-cjs.cjs'), `const { createStatusMap, filterLedger, buildTestResults } = require('@statusmap/core')
for (const [name, value] of Object.entries({ createStatusMap, filterLedger, buildTestResults })) {
  if (typeof value !== 'function') throw new Error(\`Missing CJS runtime export: \${name}\`)
}
const files = {
  '/status/areas.yaml': 'areas',
  '/status/features/core/search.yaml': 'feature',
}
const { ledger } = createStatusMap(files, (source) => source === 'areas'
  ? [{ id: 'core', label: 'Core' }]
  : { id: 'search', areaId: 'core', label: 'Search', lifecycle: 'live' })
if (ledger.features[0]?.id !== 'search') throw new Error('CJS createStatusMap did not execute correctly')
`)
	runNode('verify-core-esm.mjs', fixture)
	runNode('verify-core-cjs.cjs', fixture)

	const buildOutput = run(['run', 'build'], fixture)
	run(['audit', '--omit=dev', '--audit-level=high'], fixture)
	console.log(buildOutput.trim())
	console.log(JSON.stringify({
		result: 'passed',
		consumer: 'fresh Vue 3 + Vite project with no package-specific transpilation settings',
		core: relative(repoRoot, coreTarball),
		vue: relative(repoRoot, vueTarball),
		resolution: 'core ESM + CJS runtime and Vue source runtime resolved from fixture/node_modules',
		packedFiles: { core: corePack.files.length, vue: vuePack.files.length },
	}, null, 2))
} finally {
	const relativeWorkRoot = relative(scratchRoot, workRoot)
	if (relativeWorkRoot && !relativeWorkRoot.startsWith(`..${sep}`) && relativeWorkRoot !== '..') {
		rmSync(workRoot, { recursive: true, force: true })
	}
}
