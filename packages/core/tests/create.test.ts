import { describe, it, expect } from 'vitest'
import { load as yamlLoad } from 'js-yaml'
import { createStatusMap, validateLedger } from '../src/index'

const files = {
	'status/areas.yaml': '- id: core\n  label: Core\n  order: 1',
	'status/features/core/editor.yaml': 'id: editor\nlabel: Editor\nareaId: core\nlifecycle: live',
	// a `_`-prefixed authoring aid — must be skipped by the loader
	'status/features/_template.yaml': 'id: tmpl\nlabel: T\nareaId: core\nlifecycle: live',
}

describe('createStatusMap', () => {
	it('builds a validated bundle from a { path: rawYaml } map (splits areas vs features, skips _ files)', () => {
		const bundle = createStatusMap(files, (s) => yamlLoad(s))
		expect(validateLedger(bundle.ledger)).toEqual([])
		expect(bundle.ledger.areas.map((a) => a.id)).toEqual(['core'])
		expect(bundle.ledger.features.map((f) => f.id)).toEqual(['editor']) // _template skipped
	})
})
