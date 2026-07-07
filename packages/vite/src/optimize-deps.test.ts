import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveConfig } from 'vite'
import { generatedEntriesGlob, previewOptimizeDeps } from './optimize-deps.ts'
import { skmtcPreview } from './plugin.ts'

// The nested-monorepo layout that broke 0.2.3: the Vite app under `apps/x`, the
// `.skmtc/` project at the repo root, `basePath` repo-root-relative. The old
// config hook read the REPO ROOT's package.json for the include list (missing
// every app dep) and disabled discovery, so a transitive CJS dep
// (use-sync-external-store) reached the browser unbundled — no named exports.
describe('generatedEntriesGlob', () => {
  const project = 'testapp'
  let skmtcRoot: string
  let viteRoot: string

  const writeClientJson = async (basePath: string): Promise<void> => {
    const dir = join(skmtcRoot, '.skmtc', project, '.settings')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'client.json'), JSON.stringify({ settings: { basePath } }))
  }

  beforeAll(async () => {
    skmtcRoot = await mkdtemp(join(tmpdir(), 'skmtc-optimize-deps-'))
    viteRoot = join(skmtcRoot, 'apps', 'x')
    await mkdir(viteRoot, { recursive: true })
  })
  afterAll(async () => {
    await rm(skmtcRoot, { recursive: true, force: true })
  })

  it('resolves a repo-root-relative basePath against the nested Vite root', async () => {
    await writeClientJson('apps/x/src')
    expect(generatedEntriesGlob({ viteRoot, skmtcRoot, project })).toBe('src/**/*.{ts,tsx,js,jsx}')
  })

  it('steps out of the Vite root when the generated code lands elsewhere', async () => {
    await writeClientJson('packages/shared/src')
    expect(generatedEntriesGlob({ viteRoot, skmtcRoot, project })).toBe(
      '../../packages/shared/src/**/*.{ts,tsx,js,jsx}'
    )
  })

  it('falls back to src when client.json is missing', () => {
    expect(
      generatedEntriesGlob({ viteRoot: skmtcRoot, skmtcRoot, project: 'no-such-project' })
    ).toBe('src/**/*.{ts,tsx,js,jsx}')
  })

  it('falls back to src when client.json has no usable basePath', async () => {
    await writeClientJson('')
    expect(generatedEntriesGlob({ viteRoot: skmtcRoot, skmtcRoot, project })).toBe(
      'src/**/*.{ts,tsx,js,jsx}'
    )
  })
})

describe('previewOptimizeDeps', () => {
  it('keeps Vite default entry crawling alongside the generated glob', () => {
    const { entries } = previewOptimizeDeps({ viteRoot: '/r', skmtcRoot: '/r', project: 'p' })
    expect(entries[0]).toBe('**/*.html')
    expect(entries[1]).toBe('src/**/*.{ts,tsx,js,jsx}')
  })

  it('pre-optimizes only the react core the scanner cannot see (virtual harness)', () => {
    const { include } = previewOptimizeDeps({ viteRoot: '/r', skmtcRoot: '/r', project: 'p' })
    expect(include).toEqual([
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime'
    ])
  })
})

// The merged-config contract: the plugin contributes scan entries and the react
// core, and leaves the rest of the app's optimizer semantics alone — above all
// it must NOT disable discovery (the 0.2.3 regression) and must NOT displace
// entries or includes the app configures itself.
describe('skmtcPreview resolved Vite config', () => {
  const project = 'testapp'
  let skmtcRoot: string
  let viteRoot: string

  beforeAll(async () => {
    skmtcRoot = await mkdtemp(join(tmpdir(), 'skmtc-resolved-config-'))
    viteRoot = join(skmtcRoot, 'apps', 'x')
    await mkdir(viteRoot, { recursive: true })
    const dir = join(skmtcRoot, '.skmtc', project, '.settings')
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, 'client.json'),
      JSON.stringify({ settings: { basePath: 'apps/x/src' } })
    )
  })
  afterAll(async () => {
    await rm(skmtcRoot, { recursive: true, force: true })
  })

  const resolveWith = (userOptimizeDeps: Record<string, unknown> = {}) =>
    resolveConfig(
      {
        configFile: false,
        logLevel: 'silent',
        root: viteRoot,
        optimizeDeps: userOptimizeDeps,
        plugins: [skmtcPreview({ project, root: skmtcRoot })]
      },
      'serve'
    )

  it('leaves dep discovery enabled', async () => {
    const config = await resolveWith()
    expect(config.optimizeDeps.noDiscovery).not.toBe(true)
  })

  it('contributes the generated tree and html crawl as scan entries', async () => {
    const config = await resolveWith()
    expect(config.optimizeDeps.entries).toContain('src/**/*.{ts,tsx,js,jsx}')
    expect(config.optimizeDeps.entries).toContain('**/*.html')
  })

  it('merges additively with the app own optimizer config', async () => {
    const config = await resolveWith({ entries: ['custom/entry.ts'], include: ['lodash-es'] })
    expect(config.optimizeDeps.entries).toContain('custom/entry.ts')
    expect(config.optimizeDeps.entries).toContain('src/**/*.{ts,tsx,js,jsx}')
    expect(config.optimizeDeps.include).toContain('lodash-es')
    expect(config.optimizeDeps.include).toContain('react-dom/client')
  })
})
