import { defineConfig } from 'tsdown'

// The Node entry graph (plugin + CLI + helpers) is bundled to ESM with
// declarations. ts-pattern / valibot stay external (real npm deps), and
// `vite` is a peer — tsdown externalizes both by default.
//
// The in-iframe render harness (src/client/harness.tsx) is NOT part of this
// build: it is shipped as SOURCE and transformed at runtime by the CONSUMER's
// Vite (see preview-harness.ts), so it can share the app's React. We copy it
// next to the built entry so `new URL('./client/harness.tsx', import.meta.url)`
// resolves inside dist/.
//
// `wire` is its own entry so browser consumers (the desktop SPA) can import
// the wire schemas via `@skmtc/vite/wire` without pulling the node-only
// plugin graph into their bundle.
//
// `matcher` is the inverse: the node-only matcher machinery for non-plugin
// hosts (the preview container harness) — never for browsers.
export default defineConfig({
  entry: ['src/index.ts', 'src/enrichment-leaf.ts', 'src/wire.ts', 'src/matcher.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  copy: [{ from: 'src/client', to: 'dist' }]
})
