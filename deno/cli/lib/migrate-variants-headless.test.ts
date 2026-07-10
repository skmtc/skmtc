/**
 * Tests that {@link migrateVariantsHeadless} handles the compact
 * `client.json` form: it expands a compact file before migrating and
 * re-emits it in the same form (compact stays compact, expanded stays
 * expanded), so the migration never silently changes the on-disk format.
 *
 * `migrateVariantsHeadless` resolves the project via `toProjectPath` →
 * `toRootPath`, which walks `cwd` for `.skmtc/`, so the fixture lives
 * under a temp `.skmtc/<project>/` and the test cd's into it.
 */

import { assert, assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import {
  decodeCompact,
  encodeCompact,
  isCompactClientJson
} from '@skmtc/core/ClientJsonCompact'
import { migrateVariantsHeadless } from '@/lib/migrate-variants-headless.ts'

const PROJECT = 'migrate-compact-test'

// Old, pre-variants shape: the operation leaf is NOT wrapped in `main`.
const UNMIGRATED = {
  settings: {
    basePath: 'src',
    enrichments: {
      '@acme/gen-form': {
        '/users': { post: { title: 'Create User' } }
      }
    }
  }
}

// After migration the leaf is wrapped in `main`; everything else is unchanged.
const MIGRATED = {
  settings: {
    basePath: 'src',
    enrichments: {
      '@acme/gen-form': {
        '/users': { post: { main: { title: 'Create User' } } }
      }
    }
  }
}

const withTempRoot = async (
  fn: (clientJsonPath: string) => Promise<void>
): Promise<void> => {
  const root = await Deno.makeTempDir()
  const previousCwd = Deno.cwd()
  const settingsDir = join(root, '.skmtc', PROJECT, '.settings')
  await Deno.mkdir(settingsDir, { recursive: true })
  try {
    Deno.chdir(root)
    await fn(join(settingsDir, 'client.json'))
  } finally {
    Deno.chdir(previousCwd)
    await Deno.remove(root, { recursive: true })
  }
}

Deno.test('migrateVariantsHeadless - migrates a compact file and keeps it compact', async () => {
  await withTempRoot(async clientJsonPath => {
    await Deno.writeTextFile(clientJsonPath, JSON.stringify(encodeCompact(UNMIGRATED)))

    const result = await migrateVariantsHeadless({ projectName: PROJECT })

    assertEquals(result.alreadyMigrated, false)
    assertEquals(result.enrichmentsWrapped.length, 1)

    const parsed = JSON.parse(await Deno.readTextFile(clientJsonPath))
    assert(isCompactClientJson(parsed), 'file should remain compact after migration')
    // Expanding shows the leaf wrapped in `main`, nothing else changed.
    assertEquals(decodeCompact(parsed), MIGRATED)
  })
})

Deno.test('migrateVariantsHeadless - migrates an expanded file and keeps it expanded', async () => {
  await withTempRoot(async clientJsonPath => {
    await Deno.writeTextFile(clientJsonPath, JSON.stringify(UNMIGRATED, null, 2))

    const result = await migrateVariantsHeadless({ projectName: PROJECT })

    assertEquals(result.alreadyMigrated, false)
    const parsed = JSON.parse(await Deno.readTextFile(clientJsonPath))
    assert(!isCompactClientJson(parsed), 'file should remain expanded after migration')
    assertEquals(parsed, MIGRATED)
  })
})

Deno.test('migrateVariantsHeadless - re-running on a migrated compact file is a no-op', async () => {
  await withTempRoot(async clientJsonPath => {
    await Deno.writeTextFile(clientJsonPath, JSON.stringify(encodeCompact(UNMIGRATED)))

    await migrateVariantsHeadless({ projectName: PROJECT })
    const second = await migrateVariantsHeadless({ projectName: PROJECT })

    assertEquals(second.alreadyMigrated, true)
    assert(isCompactClientJson(JSON.parse(await Deno.readTextFile(clientJsonPath))))
  })
})
