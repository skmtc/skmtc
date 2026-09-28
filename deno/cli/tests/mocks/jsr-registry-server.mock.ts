import { encodeHex } from '@std/encoding/hex'
import { ensureDir } from '@std/fs/ensure-dir'
import { join } from '@std/path/join'
import { homedir } from 'node:os'
import { toWorker } from '@/lib/to-worker.ts'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'

/** Package name → version → source of the package's `mod.ts`. */
export type RegistryPackages = Record<string, Record<string, string>>

/**
 * The ticket's shape (#153) in miniature: the worker is built on core
 * 0.1.0; `@skmtc/gen-a@0.1.0` is too, while `@skmtc/gen-a@0.2.0` and
 * `@skmtc/gen-b@0.1.0` moved to core 0.2.0 — so pinning either puts two
 * cores in the graph.
 */
export const twoCoreRegistry: RegistryPackages = {
  '@skmtc/core': {
    '0.1.0': 'export class Definition {}\n',
    '0.2.0': 'export class Definition {}\n'
  },
  '@skmtc/worker': {
    '0.1.0': [
      "import { Definition } from 'jsr:@skmtc/core@0.1.0'",
      'export default (toGenerators: () => unknown) => [Definition, toGenerators]',
      ''
    ].join('\n')
  },
  '@skmtc/gen-a': {
    '0.1.0': [
      "import { Definition } from 'jsr:@skmtc/core@0.1.0'",
      "export default { id: '@skmtc/gen-a', Definition }",
      ''
    ].join('\n'),
    '0.2.0': [
      "import { Definition } from 'jsr:@skmtc/core@0.2.0'",
      "export default { id: '@skmtc/gen-a', Definition }",
      ''
    ].join('\n')
  },
  '@skmtc/gen-b': {
    '0.1.0': [
      "import { Definition } from 'jsr:@skmtc/core@0.2.0'",
      "export default { id: '@skmtc/gen-b', Definition }",
      ''
    ].join('\n')
  }
}

const toChecksum = async (content: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  return `sha256-${encodeHex(new Uint8Array(digest))}`
}

const handleRequest = async (packages: RegistryPackages, request: Request): Promise<Response> => {
  const notFound = new Response('Not found', { status: 404 })
  const match = new URL(request.url).pathname.match(/^\/(@[^/]+\/[^/]+)\/(.+)$/)
  if (!match) return notFound

  const [, packageName, rest] = match
  const versions = packages[packageName]
  if (!versions) return notFound

  if (rest === 'meta.json') {
    const [scope, name] = packageName.slice(1).split('/')
    return Response.json({
      scope,
      name,
      latest: Object.keys(versions).at(-1),
      versions: Object.fromEntries(Object.keys(versions).map(version => [version, {}]))
    })
  }

  const versionMeta = rest.match(/^([^/]+)_meta\.json$/)
  if (versionMeta) {
    const source = versions[versionMeta[1]]
    if (source === undefined) return notFound
    return Response.json({
      manifest: { '/mod.ts': { size: source.length, checksum: await toChecksum(source) } },
      exports: { '.': './mod.ts' }
    })
  }

  const file = rest.match(/^([^/]+)\/mod\.ts$/)
  const source = file ? versions[file[1]] : undefined
  if (source === undefined) return notFound

  return new Response(source, { headers: { 'content-type': 'application/typescript' } })
}

/**
 * Serves `packages` as a JSR registry on localhost and points `JSR_URL`
 * at it, so `deno info` / `deno bundle` subprocesses resolve `jsr:`
 * specifiers offline. `DENO_DIR` goes to a temp dir so the fake packages
 * never enter the real Deno cache.
 */
export const withJsrRegistryServer = async (
  packages: RegistryPackages,
  fn: () => Promise<void>
): Promise<void> => {
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, request =>
    handleRequest(packages, request)
  )
  const denoDir = await Deno.makeTempDir({ prefix: 'jsr-registry-deno-dir-' })
  const originalJsrUrl = Deno.env.get('JSR_URL')
  const originalDenoDir = Deno.env.get('DENO_DIR')

  Deno.env.set('JSR_URL', `http://127.0.0.1:${server.addr.port}/`)
  Deno.env.set('DENO_DIR', denoDir)

  try {
    await fn()
  } finally {
    restoreEnv('JSR_URL', originalJsrUrl)
    restoreEnv('DENO_DIR', originalDenoDir)
    await server.shutdown()
    await Deno.remove(denoDir, { recursive: true })
  }
}

const restoreEnv = (name: string, value: string | undefined) => {
  if (value === undefined) {
    Deno.env.delete(name)
  } else {
    Deno.env.set(name, value)
  }
}

type RegistryProjectArgs = {
  /** `@skmtc/gen-a` version the project pins — `0.2.0` puts two cores in the graph. */
  generatorVersion: '0.1.0' | '0.2.0'
  /** More `deno.json` imports; `gen-*` keys also go into `worker.ts`. */
  imports?: Record<string, string>
}

export type RegistryProject = {
  tempRoot: string
  projectName: string
  projectPath: string
}

/**
 * Creates `.skmtc/api/` in a temp dir inside the home directory (where
 * `toRootPath` looks), pinned to the {@link twoCoreRegistry} packages,
 * with a `worker.ts`, a placeholder `bundle.js` and a `client.json` that
 * names a schema source — and cd's into it for the duration of `fn`.
 */
export const withRegistryProject = async (
  { generatorVersion, imports = {} }: RegistryProjectArgs,
  fn: (project: RegistryProject) => Promise<void>
): Promise<void> => {
  const tempRoot = await Deno.makeTempDir({ dir: homedir(), prefix: 'registry-project-' })
  const projectName = 'api'
  const projectPath = join(tempRoot, '.skmtc', projectName)
  await ensureDir(join(projectPath, '.settings'))

  const projectImports: Record<string, string> = {
    '@skmtc/core': 'jsr:@skmtc/core@0.1.0',
    '@skmtc/worker': 'jsr:@skmtc/worker@0.1.0',
    '@skmtc/gen-a': `jsr:@skmtc/gen-a@${generatorVersion}`,
    ...imports
  }
  await Deno.writeTextFile(
    join(projectPath, 'deno.json'),
    JSON.stringify({ imports: projectImports })
  )
  await Deno.writeTextFile(
    join(projectPath, 'worker.ts'),
    toWorker(Object.keys(projectImports).filter(key => key.startsWith('@skmtc/gen-')))
  )
  await Deno.writeTextFile(join(projectPath, 'bundle.js'), 'export default undefined\n')
  await Deno.writeTextFile(
    join(tempRoot, 'openapi.json'),
    JSON.stringify({ openapi: '3.0.0', info: { title: 'api', version: '1' }, paths: {} })
  )
  await Deno.writeTextFile(
    join(projectPath, '.settings', 'client.json'),
    JSON.stringify({ source: join(tempRoot, 'openapi.json'), settings: { basePath: 'src/api' } })
  )

  const originalCwd = Deno.cwd()
  Deno.chdir(tempRoot)
  try {
    await fn({ tempRoot, projectName, projectPath })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempRoot, { recursive: true })
  }
}

/**
 * Bundles the project with plain `deno bundle` — the way a CLI without
 * the package-copies check built `bundle.js`.
 */
export const bundleWithoutCheck = async (projectPath: string): Promise<void> => {
  const { success, stderr } = await new Deno.Command('deno', {
    args: ['bundle', ...toDependencyAgeArgs(), '-o', 'bundle.js', 'worker.ts'],
    cwd: projectPath,
    stdout: 'null',
    stderr: 'piped'
  }).output()
  if (!success) throw new Error(new TextDecoder().decode(stderr))
}
