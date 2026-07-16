import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Minimal config so the demo's .vue SFCs compile. Root = this demo dir (run vite from here).
export default defineConfig({
	plugins: [vue()],
	server: { port: 4317, strictPort: true },
	preview: { port: 4317, strictPort: true },
})
