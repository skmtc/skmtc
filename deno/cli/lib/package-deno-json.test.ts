import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { PackageDenoJson } from '@/lib/package-deno-json.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'

Deno.test('PackageDenoJson - exists returns false for non-existent file', async () => {
  const exists = await PackageDenoJson.exists('/non-existent/deno.json')

  assertEquals(exists, false)
})

Deno.test('PackageDenoJson - open throws error when file does not exist', async () => {
  const manager = createMockManager()

  await assertRejects(
    async () => await PackageDenoJson.open('/non-existent/deno.json', manager),
    Error,
    'Package deno.json not found'
  )
})

Deno.test('PackageDenoJson - create and write cycle works', async () => {
  const tempDir = await Deno.makeTempDir()
  const denoJsonPath = join(tempDir, 'deno.json')

  try {
    await ensureDir(tempDir)

    const manager = createMockManager()
    const packageDenoJson = PackageDenoJson.create(
      {
        path: denoJsonPath,
        contents: {
          name: '@test/package',
          version: '1.0.0',
          exports: './mod.ts'
        }
      },
      manager
    )

    await packageDenoJson.write()

    const exists = await PackageDenoJson.exists(denoJsonPath)
    assertEquals(exists, true)

    const loaded = await PackageDenoJson.open(denoJsonPath, manager)
    assertEquals(loaded.contents.name, '@test/package')
    assertEquals(loaded.contents.version, '1.0.0')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('PackageDenoJson - lint plugin config round-trips', async () => {
  const tempDir = await Deno.makeTempDir()
  const denoJsonPath = join(tempDir, 'deno.json')

  try {
    const manager = createMockManager()
    const packageDenoJson = PackageDenoJson.create(
      {
        path: denoJsonPath,
        contents: {
          name: '@test/package',
          version: '1.0.0',
          exports: './mod.ts',
          lint: { plugins: ['jsr:@skmtc/lint-plugin@^0.1.0'] }
        }
      },
      manager
    )

    await packageDenoJson.write()

    const loaded = await PackageDenoJson.open(denoJsonPath, manager)
    assertEquals(loaded.contents.lint?.plugins, ['jsr:@skmtc/lint-plugin@^0.1.0'])
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('PackageDenoJson - open adds cleanup action to manager', async () => {
  const tempDir = await Deno.makeTempDir()
  const denoJsonPath = join(tempDir, 'deno.json')

  try {
    await ensureDir(tempDir)

    const manager = createMockManager()
    const packageDenoJson = PackageDenoJson.create(
      {
        path: denoJsonPath,
        contents: { name: '@test/pkg', version: '1.0.0', exports: './mod.ts' }
      },
      manager
    )

    await packageDenoJson.write()

    const initialCleanupCount = manager.cleanupActions.length
    await PackageDenoJson.open(denoJsonPath, manager)

    assertEquals(manager.cleanupActions.length > initialCleanupCount, true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
