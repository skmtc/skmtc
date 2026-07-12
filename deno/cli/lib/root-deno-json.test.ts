import { assertEquals } from '@std/assert/equals'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'

Deno.test('RootDenoJson - create returns instance with empty contents', () => {
  const denoJson = RootDenoJson.create('test-project')

  assertEquals(denoJson.projectName, 'test-project')
  assertEquals(denoJson.contents, {})
})

Deno.test('RootDenoJson - toGeneratorIds filters generator packages', () => {
  const manager = createMockManager()
  const denoJson = RootDenoJson.create('test-project')

  denoJson.contents = {
    imports: {
      '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@^1.0.0',
      '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@^1.0.0',
      '@std/assert': 'jsr:@std/assert@^1.0.0'
    }
  }

  const generatorIds = denoJson.toGeneratorIds()

  assertEquals(generatorIds.length, 2)
  assertEquals(generatorIds.includes('@skmtc/gen-typescript'), true)
  assertEquals(generatorIds.includes('@skmtc/gen-zod'), true)
  assertEquals(generatorIds.includes('@std/assert'), false)
})

Deno.test('RootDenoJson - addImport adds new import to contents', () => {
  const denoJson = RootDenoJson.create('test-project')

  denoJson.addImport('@skmtc/gen-typescript', 'jsr:@skmtc/gen-typescript@^1.0.0')

  assertEquals(
    denoJson.contents.imports?.['@skmtc/gen-typescript'],
    'jsr:@skmtc/gen-typescript@^1.0.0'
  )
})

Deno.test('RootDenoJson - addWorkspace adds workspace path', () => {
  const denoJson = RootDenoJson.create('test-project')

  denoJson.addWorkspace('./packages/gen-custom')

  assertEquals(denoJson.contents.workspace?.includes('./packages/gen-custom'), true)
})

Deno.test('RootDenoJson - isLocalModule detects local modules', () => {
  const isLocal1 = RootDenoJson.isLocalModule('./local-gen')
  const isLocal2 = RootDenoJson.isLocalModule('jsr:@skmtc/gen-typescript@^1.0.0')

  assertEquals(isLocal1, true)
  assertEquals(isLocal2, false)
})

Deno.test('RootDenoJson - write and open cycle works', async () => {
  const tempDir = await Deno.makeTempDir()
  const projectName = crypto.randomUUID()

  // Mock toProjectPath to use temp directory
  const mockToProjectPath = () => join(tempDir, projectName)
  const originalToPath = RootDenoJson.toPath
  RootDenoJson.toPath = () => join(mockToProjectPath(), 'deno.json')

  try {
    await ensureDir(join(tempDir, projectName))

    const manager = createMockManager()
    const denoJson = RootDenoJson.create(projectName)

    denoJson.addImport('@skmtc/gen-typescript', 'jsr:@skmtc/gen-typescript@^1.0.0')

    await denoJson.write()

    const loaded = await RootDenoJson.open(projectName, manager)

    assertEquals(
      loaded.contents.imports?.['@skmtc/gen-typescript'],
      'jsr:@skmtc/gen-typescript@^1.0.0'
    )
  } finally {
    RootDenoJson.toPath = originalToPath
    await Deno.remove(tempDir, { recursive: true })
  }
})
