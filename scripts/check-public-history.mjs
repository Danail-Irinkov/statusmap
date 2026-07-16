import { spawnSync, execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPublicLeaks } from './public-leak-rules.mjs'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const commits = execFileSync('git', ['rev-list', '--all'], { cwd: repoRoot, encoding: 'utf8' })
	.trim()
	.split(/\s+/)
	.filter(Boolean)

const privateNames = [
	['friend', 'bot'], ['we', 'ko', 've'], ['ko', 've'], ['i', 'connect'], ['re', 'max'],
	['var', 'na'], ['al', 'ina'], ['fr', 'bot'], ['my', 'friend', '-', '9256', 'e'],
].map((parts) => parts.join(''))
const historyPattern = [
	...privateNames,
	'[A-Za-z]:[/\\\\](code|users)[/\\\\]',
	'sk-[A-Za-z0-9_-]{20,}',
	'npm_[A-Za-z0-9]{20,}',
	'_auth(Token)?[[:space:]]*=[[:space:]]*[^$<[:space:]#]+',
	'gh[pousr]_[A-Za-z0-9]{36,}',
	'AIza[A-Za-z0-9_-]{35}',
	'AKIA[0-9A-Z]{16}',
].join('|')

const offenders = []
for (const commit of commits) {
	const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', commit], {
		cwd: repoRoot,
		encoding: 'utf8',
	})
	offenders.push(...findPublicLeaks(`${commit.slice(0, 8)} file paths`, paths))

	const grep = spawnSync('git', ['grep', '-I', '-n', '-i', '-E', historyPattern, commit, '--', '.'], {
		cwd: repoRoot,
		encoding: 'utf8',
	})
	if (grep.status === 0 && grep.stdout.trim()) {
		offenders.push(...grep.stdout.trim().split(/\r?\n/).map((line) => `${commit.slice(0, 8)} content: ${line}`))
	} else if (grep.status !== 1) {
		throw new Error(grep.stderr || `git grep failed for ${commit}`)
	}
}

const unique = [...new Set(offenders)]
if (unique.length) {
	console.error(`Public-history leak guard failed with ${unique.length} finding(s):`)
	for (const offender of unique.slice(0, 30)) console.error(`- ${offender}`)
	if (unique.length > 30) console.error(`- … ${unique.length - 30} more`)
	process.exitCode = 1
} else {
	console.log(`Public-history leak guard passed (${commits.length} reachable commits).`)
}
