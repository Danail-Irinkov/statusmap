// The ONE tone → token resolver. No section component hard-codes a status color; every tint flows from
// here. A tone collapses onto one of five CSS custom-property families (per DEFAULT_STATUS_RULES), which the
// renderer's stylesheet defines:
//   --statusmap-<family>-{fg,bg,border,dot}   for family ∈ done | attention | problem | neutral | active

import type { StatusTone } from './types'
import { DEFAULT_STATUS_RULES as RULES, type StateFamily } from './status-rules'

export type StatusToneToken = {
	family: StateFamily
	fg: string //     readable foreground on `bg`
	bg: string //     tinted surface
	border: string // tint border (card / panel / cell edge)
	dot: string //    saturated status dot
	label: string //  default human label for the tone
}

export function statusToneFamily(tone: StatusTone): StateFamily {
	return RULES.toneFamily[tone] ?? 'neutral'
}

export function statusTone(tone: StatusTone): StatusToneToken {
	const family = statusToneFamily(tone)
	return {
		family,
		fg: `var(--statusmap-${family}-fg)`,
		bg: `var(--statusmap-${family}-bg)`,
		border: `var(--statusmap-${family}-border)`,
		dot: `var(--statusmap-${family}-dot)`,
		label: RULES.toneLabel[tone] ?? 'Neutral',
	}
}

// Convenience for inline `:style` binds — exposes the token as CSS custom properties so a component's
// scoped CSS can read `var(--tone-fg)` etc. without re-deriving the family.
export function statusToneVars(tone: StatusTone): Record<string, string> {
	const t = statusTone(tone)
	return {
		'--tone-fg': t.fg,
		'--tone-bg': t.bg,
		'--tone-border': t.border,
		'--tone-dot': t.dot,
	}
}
