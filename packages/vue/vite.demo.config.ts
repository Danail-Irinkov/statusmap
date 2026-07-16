import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Builds the demo/ app to demo-dist/ as static files (base './' so it opens from file://).
export default defineConfig({
	root: 'demo',
	base: './',
	plugins: [vue()],
	build: {
		outDir: '../demo-dist',
		emptyOutDir: true,
	},
})
