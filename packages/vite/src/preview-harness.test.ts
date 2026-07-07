import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer, type ViteDevServer } from 'vite'
import { PROVIDERS_RESOLVED_ID, findProvidersFile } from './preview-harness.ts'
import { skmtcPreview } from './plugin.ts'

describe('findProvidersFile', () => {
  let viteRoot: string

  beforeAll(async () => {
    viteRoot = await mkdtemp(join(tmpdir(), 'skmtc-providers-'))
    await mkdir(join(viteRoot, 'src'), { recursive: true })
  })
  afterAll(async () => {
    await rm(viteRoot, { recursive: true, force: true })
  })

  it('returns undefined when the app has no providers file', () => {
    expect(findProvidersFile(viteRoot)).toBeUndefined()
  })

  it('finds the providers file and prefers tsx over ts', async () => {
    await writeFile(join(viteRoot, 'src', 'preview-providers.ts'), 'export {}\n')
    expect(findProvidersFile(viteRoot)).toBe(join(viteRoot, 'src', 'preview-providers.ts'))
    await writeFile(join(viteRoot, 'src', 'preview-providers.tsx'), 'export {}\n')
    expect(findProvidersFile(viteRoot)).toBe(join(viteRoot, 'src', 'preview-providers.tsx'))
  })
})

describe('skmtcPreview plugin declaration', () => {
  const plugin = skmtcPreview({ project: 'testapp' })

  // Issue R: @cloudflare/vite-plugin (and other Worker-runtime plugins) install
  // request-routing middleware at `enforce: 'pre'`; a normal-enforce
  // skmtcPreview registers after it and loses the ungated /__skmtc/handshake to
  // the Worker's SPA/404 fallback.
  it('self-declares pre enforcement so /__skmtc/* middleware wins', () => {
    expect(plugin.enforce).toBe('pre')
  })

  it('applies only to the dev server, never to builds', () => {
    expect(plugin.apply).toBe('serve')
  })
})

// The providers VIRTUAL id, resolved by a real dev server: to the pass-through
// module when the app has no providers file (no browser probe, no 404/MIME
// console error — the 0.2.3 behavior), and to the consumer's file when one
// exists.
describe('virtual:skmtc-preview-providers resolution', () => {
  const project = 'testapp'
  let viteRoot: string
  const servers: ViteDevServer[] = []

  const startServer = async (): Promise<ViteDevServer> => {
    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      root: viteRoot,
      server: { middlewareMode: true },
      plugins: [skmtcPreview({ project, root: viteRoot })]
    })
    servers.push(server)
    return server
  }

  beforeAll(async () => {
    viteRoot = await mkdtemp(join(tmpdir(), 'skmtc-providers-server-'))
    await mkdir(join(viteRoot, 'src'), { recursive: true })
  })
  afterAll(async () => {
    await Promise.all(servers.map((server) => server.close()))
    await rm(viteRoot, { recursive: true, force: true })
  })

  it('serves a pass-through module when the app has no providers file', async () => {
    const dev = await startServer()
    const resolved = await dev.environments.client.pluginContainer.resolveId(
      'virtual:skmtc-preview-providers'
    )
    expect(resolved?.id).toBe(PROVIDERS_RESOLVED_ID)
    const transformed = await dev.environments.client.transformRequest(
      'virtual:skmtc-preview-providers'
    )
    expect(transformed?.code).toContain('props.children')
  })

  it('resolves to the consumer file once it exists', async () => {
    const providersFile = join(viteRoot, 'src', 'preview-providers.tsx')
    await writeFile(providersFile, 'export const PreviewProviders = (p) => p.children\n')
    const dev = await startServer()
    const resolved = await dev.environments.client.pluginContainer.resolveId(
      'virtual:skmtc-preview-providers'
    )
    expect(resolved?.id).toBe(providersFile)
  })
})
