import { assertEquals } from '@std/assert/equals'
import { ClientJson } from '@/lib/client-json.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'

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
