// The plugin's `optimizeDeps` contribution — additive only. The preview harness
// dynamic-imports generated modules with `@vite-ignore`, so Vite's entry scanner
// can't see them: without help, their deps are only discovered lazily at preview
// load, re-optimizing mid-load and wedging the iframe (the 504 "Outdated
// Optimize Dep"). The fix is to hand Vite the information only this plugin has —
// the generated tree as extra scan ENTRIES — so its whole dep graph is optimized
// up front by Vite's own scanner and CJS interop. The plugin never overrides the
// app's optimizer semantics (an earlier `noDiscovery` + hand-built include list
// broke any dep the list missed: the include set came from one `package.json`,
// which can't see monorepo layouts or transitive-only CJS deps).

import { readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { clientJsonPath } from './client-json.ts'

// Always pre-optimized: the harness virtual module imports these, and being
// virtual it is invisible to the scanner. Additive — merged into any include
// list the app already configures.
const REACT_CORE = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime'
]

/** `settings.basePath` from the project's on-disk `client.json` — where the
 *  generated code lands, relative to the SKMTC root. Absent or unreadable →
 *  the CLI's default `src`. */
const readBasePath = (skmtcRoot: string, project: string): string => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(clientJsonPath(skmtcRoot, project), 'utf8'))
    if (parsed === null || typeof parsed !== 'object') return 'src'
    const settings = (parsed as Record<string, unknown>).settings
    if (settings === null || typeof settings !== 'object') return 'src'
    const basePath = (settings as Record<string, unknown>).basePath
    return typeof basePath === 'string' && basePath !== '' ? basePath : 'src'
  } catch {
    return 'src'
  }
}

export type PreviewOptimizeDepsInput = {
  /** The Vite project root (`config.root`) — entry globs resolve against it. */
  viteRoot: string
  /** The SKMTC root (the directory containing `.skmtc/`) — `basePath` is
   *  relative to it. Same as `viteRoot` for a locally-onboarded app; the repo
   *  root when the app is nested in a monorepo. */
  skmtcRoot: string
  project: string
}

/** The generated-output glob, relative to the Vite root in posix form (fast-glob
 *  rejects backslashes; `relative` may also step out of the root with `../`). */
export const generatedEntriesGlob = ({
  viteRoot,
  skmtcRoot,
  project
}: PreviewOptimizeDepsInput): string => {
  const generatedDir = relative(viteRoot, join(skmtcRoot, readBasePath(skmtcRoot, project)))
  const segments = generatedDir === '' ? [] : generatedDir.split(sep)
  return [...segments, '**', '*.{ts,tsx,js,jsx}'].join('/')
}

// The full `optimizeDeps` contribution for the plugin's `config` hook. The
// html glob reproduces Vite's default entry crawl, which an explicit `entries`
// value would otherwise REPLACE (Vite still applies its standard ignores —
// node_modules, outDir — to explicit patterns).
export const previewOptimizeDeps = (
  input: PreviewOptimizeDepsInput
): { entries: string[]; include: string[] } => ({
  entries: ['**/*.html', generatedEntriesGlob(input)],
  include: [...REACT_CORE]
})
