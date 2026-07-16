// Build-only entry for the SHIPPED BUNDLE (see ../vite.lib.config.mjs). The package itself ships source
// (index.ts) for source-runtime consumers; this entry exists only so the lib build can emit a single
// self-contained bundle for consumers that need a pre-built artifact:
//   - re-exports the full public API (so `import { StatusMap } from '<bundle>'` works), and
//   - pulls in the canonical @statusmap/core stylesheet so the build emits one minified statusmap.css.
export * from './index'
import '../../core/src/styles/statusmap.css'
