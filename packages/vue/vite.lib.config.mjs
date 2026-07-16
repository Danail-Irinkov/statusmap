import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

// Library build → a single self-contained, minified ESM bundle for pre-built consumers.
//   - entry: src/bundle-entry.ts (public API + the canonical stylesheet)
//   - `vue` is EXTERNAL (peer) — the host app provides it, so there's one Vue instance
//   - @statusmap/core (its built dist) and js-yaml are INLINED → the bundle has no runtime deps but vue
//   - CSS is extracted to one minified statusmap.css (cssCodeSplit:false + cssFileName)
// Output: dist/statusmap.es.js + dist/statusmap.css.  Build with: npm run build:bundle
export default defineConfig({
	plugins: [vue()],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		cssCodeSplit: false,
		// Vite 8 (rolldown) minifies with its native oxc; `minify: 'esbuild'` would require esbuild as a
		// separate install. `true` uses the built-in oxc minifier — no extra dependency.
		minify: true,
		lib: {
			entry: fileURLToPath(new URL('./src/bundle-entry.ts', import.meta.url)),
			formats: ['es'],
			fileName: (format) => `statusmap.${format}.js`,
			cssFileName: 'statusmap',
		},
		rollupOptions: {
			external: ['vue', /^vue\//],
			output: { globals: { vue: 'Vue' } },
		},
	},
})
