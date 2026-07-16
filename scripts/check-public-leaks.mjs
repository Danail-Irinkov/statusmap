import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPublicLeaks } from './public-leak-rules.mjs'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const textExtensions = new Set([
	'', '.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.vue', '.yaml', '.yml',
])
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
	cwd: repoRoot,
	encoding: 'utf8',
})
	.split('\0')
	.filter(Boolean)
	.filter((file) => textExtensions.has(extname(file).toLowerCase()))

const offenders = []
for (const file of tracked) {
	const content = readFileSync(resolve(repoRoot, file), 'utf8')
	const findings = findPublicLeaks(file, content)
	offenders.push(...(file.endsWith('package-lock.json')
		? findings.filter((finding) => !finding.endsWith(': email address'))
		: findings))
}

if (offenders.length) {
	console.error('Public-tree leak guard failed:')
	for (const offender of offenders) console.error(`- ${offender}`)
	process.exitCode = 1
} else {
	console.log(`Public-tree leak guard passed (${tracked.length} public text files).`)
}
