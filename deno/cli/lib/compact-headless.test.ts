/**
 * Tests for {@link compactHeadless}. Exercises the four branches —
 * missing file, compact, expand, and already-in-target-form no-op —
 * against a throwaway `.skmtc/<project>/.settings/client.json` under a
 * temp cwd (mirroring how the CLI discovers the root from `Deno.cwd()`).
 */

import { assert, assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import { isCompactClientJson } from '@skmtc/core/ClientJsonCompact'
import { compactHeadless } from '@/lib/compact-headless.ts'

const PROJECT = 'compact-test'

const withTempRoot = async (
  fn: (clientJsonPath: string) => Promise<void>
): Promise<void> => {
  const root = await Deno.makeTempDir()
  const previousCwd = Deno.cwd()
  const settingsDir = join(root, '.skmtc', PROJECT, '.settings')
  await Deno.mkdir(settingsDir, { recursive: true })
  const clientJsonPath = join(settingsDir, 'client.json')
  try {
    Deno.chdir(root)
    await fn(clientJsonPath)
  } finally {
    Deno.chdir(previousCwd)
    await Deno.remove(root, { recursive: true })
  }
}

const SAMPLE = {
  project: '@acme/api',
  source: './schema.json',
  settings: {
    basePath: 'src',
    enrichments: {
      '@acme/gen-form': {
        '/users': { post: { main: { title: 'Create', fields: [] } } }
      }
    }
  }
}

Deno.test('compactHeadless - reports missing when there is no client.json', async () => {
  await withTempRoot(async clientJsonPath => {
    await Deno.remove(clientJsonPath).catch(() => {})
    const result = await compactHeadless({ projectName: PROJECT, expand: false })
    assert(result.missing)
    assert(!result.changed)
  })
})

Deno.test('compactHeadless - compacts an expanded file and is lossless on expand', async () => {
  await withTempRoot(async clientJsonPath => {
    await Deno.writeTextFile(clientJsonPath, JSON.stringify(SAMPLE, null, 2) + '\n')

    const compacted = await compactHeadless({ projectName: PROJECT, expand: false })
    assert(compacted.changed)
    assert(!compacted.wasCompact)
    assert(compacted.toCompact)
    assert(compacted.afterBytes < compacted.beforeBytes)
    assert(isCompactClientJson(JSON.parse(await Deno.readTextFile(clientJsonPath))))

    const expanded = await compactHeadless({ projectName: PROJECT, expand: true })
    assert(expanded.changed)
    assert(expanded.wasCompact)
    assertEquals(JSON.parse(await Deno.readTextFile(clientJsonPath)), SAMPLE)
  })
})

Deno.test('compactHeadless - no-op when already in the target form', async () => {
  await withTempRoot(async clientJsonPath => {
    await Deno.writeTextFile(clientJsonPath, JSON.stringify(SAMPLE, null, 2) + '\n')

    // Already expanded, asked to expand → unchanged.
    const result = await compactHeadless({ projectName: PROJECT, expand: true })
    assert(!result.changed)
    assertEquals(result.beforeBytes, result.afterBytes)
  })
})
