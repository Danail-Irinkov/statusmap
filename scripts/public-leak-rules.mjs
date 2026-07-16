// Private identifiers are intentionally split so the guard cannot match its own source.
const privateTerms = [
	['friend', 'bot'],
	['we', 'ko', 've'],
	['ko', 've'],
	['i', 'connect'],
	['re', 'max'],
	['var', 'na'],
	['al', 'ina'],
	['fr', 'bot'],
	['my', 'friend', '-', '9256', 'e'],
]

export const PUBLIC_LEAK_CHECKS = [
	...privateTerms.map((parts, index) => ({
		label: `known private identifier ${index + 1}`,
		pattern: new RegExp(index === 2 ? `\\b${parts.join('')}\\b` : parts.join(''), 'i'),
	})),
	{ label: 'local machine path', pattern: /[a-z]:[\\/](?:code|users)[\\/]/i },
	{ label: 'email address', pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i },
	{ label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
	{ label: 'OpenAI-style secret', pattern: /\bsk-[a-z0-9_-]{20,}\b/i },
	{ label: 'npm access token', pattern: /\bnpm_[a-z0-9]{20,}\b/i },
	{
		label: 'npm auth assignment',
		pattern: /(?:^|\n)\s*(?:\/\/[^\s=]+\/:)?_auth(?:Token)?\s*=\s*(?!\$\{?[A-Z_][A-Z0-9_]*\}?|<[^>]+>)[^\s#]+/im,
	},
	{ label: 'GitHub token', pattern: /\bgh[pousr]_[a-z0-9]{36,255}\b/i },
	{ label: 'Google API key', pattern: /\bAIza[a-z0-9_-]{35}\b/i },
	{ label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
]

export function findPublicLeaks(file, content) {
	return PUBLIC_LEAK_CHECKS.filter((check) => check.pattern.test(content)).map((check) => `${file}: ${check.label}`)
}
