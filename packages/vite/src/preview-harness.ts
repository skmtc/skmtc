// Serve the browser-side client modules (the in-iframe render harness and the
// editor shell) through the consumer app's Vite as virtual modules, so THAT Vite
// transforms them — sharing the app's React and giving them `import.meta.hot`.
// We pre-transform TSX → JS with Vite's oxc transform (the virtual ids carry no
// `.tsx` extension); Vite still post-processes — resolving the bare `react`
// imports against the app's copy and injecting the HMR context.
//
// Vite 8 dropped the bundled esbuild: `transformWithEsbuild` now throws unless
// esbuild is installed separately, so we use `transformWithOxc` (Vite's built-in
// oxc-backed transform) instead.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { transformWithOxc } from 'vite'

// virtual id → source file (relative to this module). Only the HARNESS is a
// virtual module (it must be transformed by the CONSUMER's Vite to share the
// app's React). The editor is a self-contained pre-built SPA served as static
// assets (see plugin.ts), not a virtual module.
const CLIENT_MODULES: Record<string, string> = {
  'virtual:skmtc-preview-harness': './client/harness.tsx'
}

const HARNESS_ID = 'virtual:skmtc-preview-harness'

/** Vite `resolveId` for the client virtual modules. */
export const resolveClientModule = (id: string): string | undefined =>
  id in CLIENT_MODULES ? `\0${id}` : undefined

/** Vite `load` for the client virtual modules — TSX → JS via oxc. */
export const loadClientModule = async (id: string): Promise<string | undefined> => {
  if (!id.startsWith('\0')) return undefined
  const relative = CLIENT_MODULES[id.slice(1)]
  if (!relative) return undefined
  const sourcePath = fileURLToPath(new URL(relative, import.meta.url))
  const result = await transformWithOxc(readFileSync(sourcePath, 'utf8'), sourcePath, {
    lang: 'tsx',
    jsx: { runtime: 'automatic' }
  })
  return result.code
}

/** The URL Vite serves the harness virtual module at (`\0` → `__x00__`). */
const HARNESS_URL = `/@id/__x00__${HARNESS_ID}`

/** The harness source file on disk — the plugin watches it to invalidate the
 *  cached virtual module on change, so harness edits go live without an app
 *  restart (Vite caches the transform; `load` reading fresh isn't enough). */
export const HARNESS_SOURCE_PATH = fileURLToPath(
  new URL(CLIENT_MODULES[HARNESS_ID], import.meta.url)
)

/** The resolved virtual id, for `server.moduleGraph.invalidateModule`. */
export const HARNESS_RESOLVED_ID = `\0${HARNESS_ID}`

/**
 * The iframe document — one generated module (`?module=&export=`) renders here.
 *
 * Served FULLY STATIC (no `transformIndexHtml`): for a non-file HTML served via
 * middleware, Vite's html-proxy / `/@id/` decoding mangles the harness id. So we
 * inline what `transformIndexHtml` would inject — the `@vitejs/plugin-react`
 * preamble (so React-plugin-transformed generated modules find `$RefreshReg$`)
 * and the Vite HMR client — and load the harness via a runtime dynamic import of
 * its served URL (a verbatim string, untouched by any HTML transform).
 */
export const IFRAME_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>skmtc preview</title>
    <style>
      html, body, #root { height: 100%; margin: 0; }
      .skmtc-preview-loading { display: flex; height: 100%; align-items: center; justify-content: center; color: #9ca3af; font-family: system-ui, sans-serif; }
      .skmtc-preview-error { display: flex; flex-direction: column; gap: 4px; height: 100%; overflow: auto; padding: 16px; background: #fef2f2; color: #b91c1c; font: 12px/1.5 ui-monospace, monospace; }
      .skmtc-preview-error span { font-weight: 600; }
      .skmtc-preview-error pre { white-space: pre-wrap; margin: 0; }
    </style>
    <script type="module">
      import RefreshRuntime from '/@react-refresh'
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>
    <script type="module" src="/@vite/client"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">import(${JSON.stringify(HARNESS_URL)})</script>
  </body>
</html>`
