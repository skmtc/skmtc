import { assertEquals } from '@std/assert/equals'
import { assert } from '@std/assert/assert'
import { ClientJson } from '@/lib/client-json.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { encodeCompact, isCompactClientJson } from '@skmtc/core/ClientJsonCompact'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'

const COMPACT_SAMPLE = {
  project: '@acme/api',
  source: './schema.json',
  settings: {
    basePath: 'src',
    enrichments: {
      '@acme/gen-form': { '/users': { post: { main: { title: 'Create User' } } } }
    }
  }
}

const withClientJson = async (
  fn: (clientPath: string) => Promise<void>
): Promise<void> => {
  const tempDir = await Deno.makeTempDir()
  try {
    await ensureDir(join(tempDir, '.settings'))
    await fn(join(tempDir, '.settings', 'client.json'))
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
}

const readParsed = async (path: string): Promise<unknown> =>
  JSON.parse(await Deno.readTextFile(path))

Deno.test('ClientJson - create returns instance with default settings', () => {
  const path = '/test/path/client.json'
  const clientJson = ClientJson.create({ path, basePath: 'src' })

  assertEquals(clientJson.contents?.settings.basePath, 'src')
  assertEquals(clientJson.path, path)
})

Deno.test('ClientJson - toPath returns correct path', () => {
  const projectPath = '/test/project'
  const path = ClientJson.toPath({ projectPath })

  assertEquals(path.includes('.settings'), true)
  assertEquals(path.endsWith('client.json'), true)
})

Deno.test('ClientJson - updateContents merges settings', () => {
  const clientJson = ClientJson.create({ path: '/test', basePath: 'src' })

  clientJson.updateContents({ settings: { basePath: 'lib' } })

  assertEquals(clientJson.contents?.settings.basePath, 'lib')
})

Deno.test('ClientJson - open returns null contents when file does not exist', async () => {
  const manager = createMockManager()
  const clientJson = await ClientJson.open({
    path: '/non-existent/client.json',
    manager
  })

  assertEquals(clientJson.contents, null)
})

Deno.test('ClientJson - write and open cycle works', async () => {
  const tempDir = await Deno.makeTempDir()
  const clientPath = join(tempDir, '.settings', 'client.json')

  try {
    await ensureDir(join(tempDir, '.settings'))

    const clientJson = ClientJson.create({ path: clientPath, basePath: 'src' })
    await clientJson.write()

    const manager = createMockManager()
    const loaded = await ClientJson.open({ path: clientPath, manager })

    assertEquals(loaded.contents?.settings.basePath, 'src')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('ClientJson - open expands a compact file and flags it compact', async () => {
  await withClientJson(async clientPath => {
    await Deno.writeTextFile(clientPath, JSON.stringify(encodeCompact(COMPACT_SAMPLE)))

    const clientJson = await ClientJson.open({ path: clientPath, manager: createMockManager() })

    assertEquals(clientJson.compact, true)
    assertEquals(clientJson.contents?.settings.basePath, 'src')
    assertEquals(clientJson.contents?.project, '@acme/api')
    assertEquals(
      clientJson.contents?.settings.enrichments?.['@acme/gen-form'],
      COMPACT_SAMPLE.settings.enrichments['@acme/gen-form']
    )
  })
})

Deno.test('ClientJson - open reads an expanded file and flags it expanded', async () => {
  await withClientJson(async clientPath => {
    await Deno.writeTextFile(clientPath, JSON.stringify(COMPACT_SAMPLE, null, 2))

    const clientJson = await ClientJson.open({ path: clientPath, manager: createMockManager() })

    assertEquals(clientJson.compact, false)
    assertEquals(clientJson.contents?.settings.basePath, 'src')
  })
})

Deno.test('ClientJson - a compact-read file is rewritten compact and round-trips', async () => {
  await withClientJson(async clientPath => {
    await Deno.writeTextFile(clientPath, JSON.stringify(encodeCompact(COMPACT_SAMPLE)))
    const clientJson = await ClientJson.open({ path: clientPath, manager: createMockManager() })

    await clientJson.write()

    assert(isCompactClientJson(await readParsed(clientPath)))
    const reopened = await ClientJson.open({ path: clientPath, manager: createMockManager() })
    assertEquals(reopened.compact, true)
    assertEquals(reopened.contents?.settings.basePath, 'src')
  })
})

Deno.test('ClientJson - an expanded-read file stays expanded on write', async () => {
  await withClientJson(async clientPath => {
    await Deno.writeTextFile(clientPath, JSON.stringify(COMPACT_SAMPLE, null, 2))
    const clientJson = await ClientJson.open({ path: clientPath, manager: createMockManager() })

    await clientJson.write()

    assert(!isCompactClientJson(await readParsed(clientPath)))
    // Pretty-printed: has indented newlines, not minified onto one line.
    assert((await Deno.readTextFile(clientPath)).includes('\n  '))
  })
})

Deno.test('ClientJson - create defaults to the expanded form', () => {
  const clientJson = ClientJson.create({ path: '/tmp/x/client.json', basePath: 'src' })
  assertEquals(clientJson.compact, false)
})
