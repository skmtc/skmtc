#!/usr/bin/env -S deno run --allow-read --allow-env --allow-net --allow-run
/**
 * Publish `@skmtc/core` to npm when the registry is behind the source.
 *
 * The npm registry is the source of truth for what is published — mirroring
 * the JSR cascade in `../../.scripts/release.ts`. This reads `core/deno.json`'s
 * version and, if npm lacks it, runs the dnt build (`deno task build`) and
 * `npm publish`. Idempotent: a no-op when npm already has the current version,
 * so it is safe to run on every merge to main alongside the JSR release.
 *
 * `core` sits at the root of the workspace dependency tree, so the release
 * cascade never patch-bumps it — its `deno.json` version is always the one a
 * human committed, which is exactly the version this ships.
 *
 * Auth in CI is npm Trusted Publishing (OIDC) — no `NPM_TOKEN`. The calling
 * workflow must grant `id-token: write` and npmjs.com must list this repo as a
 * trusted publisher for `@skmtc/core`; `npm publish` then mints a short-lived
 * token and attaches provenance automatically. Run locally, it uses your
 * existing `npm login` and skips provenance.
 */

import { dirname, fromFileUrl, join } from '@std/path'

export const NPM_REGISTRY = 'https://registry.npmjs.org/'
export const PACKAGE_NAME = '@skmtc/core'

type Packument = { versions?: Record<string, unknown> }

/** Whether `@skmtc/core@version` is already on the npm registry. */
export const isVersionOnNpm = (packument: Packument | null, version: string): boolean =>
  Boolean(packument?.versions?.[version])

/**
 * Fetch the npm packument, or `null` when the package does not exist yet
 * (404 — the very first publish).
 */
export const fetchNpmPackument = async (
  registry: string,
  name: string
): Promise<Packument | null> => {
  const res = await fetch(`${registry}${name}`)
  if (res.status === 404) {
    await res.body?.cancel()
    return null
  }
  if (!res.ok) {
    throw new Error(`npm registry lookup for ${name} failed: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Packument
}

const run = async (cmd: string, args: string[], cwd: string): Promise<void> => {
  const result = await new Deno.Command(cmd, {
    args,
    cwd,
    stdout: 'inherit',
    stderr: 'inherit'
  }).output()
  if (!result.success) {
    throw new Error(`\`${cmd} ${args.join(' ')}\` failed (exit ${result.code}).`)
  }
}

export const publishNpm = async (): Promise<void> => {
  const coreDir = join(dirname(fromFileUrl(import.meta.url)), '..')
  const denoJson = JSON.parse(await Deno.readTextFile(join(coreDir, 'deno.json'))) as {
    version?: string
  }
  const version = denoJson.version
  if (!version) throw new Error('core/deno.json has no version.')

  console.log(`Source: ${PACKAGE_NAME}@${version}`)
  const packument = await fetchNpmPackument(NPM_REGISTRY, PACKAGE_NAME)

  if (isVersionOnNpm(packument, version)) {
    console.log(`Already on npm — nothing to publish.`)
    return
  }

  console.log(`npm is behind — building and publishing ${PACKAGE_NAME}@${version}...`)
  await run('deno', ['task', 'build'], coreDir)

  // Provenance requires an OIDC context (CI); locally we publish without it.
  const inCi = Boolean(Deno.env.get('GITHUB_ACTIONS'))
  const publishArgs = ['publish', '--access', 'public', ...(inCi ? ['--provenance'] : [])]
  const packageDir = join(coreDir, '..', '..', 'packages', 'core')
  await run('npm', publishArgs, packageDir)

  console.log(`\nPublished ${PACKAGE_NAME}@${version} to npm.`)
}

if (import.meta.main) {
  try {
    await publishNpm()
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    Deno.exit(1)
  }
}
