import { defineConfig } from 'tsdown'

// The Node entry graph (plugin + CLI + helpers) is bundled to ESM with
// declarations. ts-pattern / zod stay external (real npm deps), and `vite`
// is a peer — tsdown externalizes both by default.
//
// The in-iframe render harness (src/client/harness.tsx) is NOT part of this
// build: it is shipped as SOURCE and transformed at runtime by the CONSUMER's
// Vite (see preview-harness.ts), so it can share the app's React. We copy it
// next to the built entry so `new URL('./client/harness.tsx', import.meta.url)`
// resolves inside dist/.
export default defineConfig({
  entry: ['src/index.ts', 'src/enrichment-leaf.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  copy: [{ from: 'src/client', to: 'dist' }]
})
