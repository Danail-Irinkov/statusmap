import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['./src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	sourcemap: true,
	clean: true,
	treeshake: true,
	shims: true,
	// Package checks run as a dedicated CI step so the CSS entrypoint can be excluded intentionally.
	failOnWarn: 'ci-only',
})
