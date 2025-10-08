import { assertEquals } from '@std/assert/equals'
import { Manifest } from '@/lib/manifest.ts'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'

Deno.test('Manifest - open creates instance with null contents when file does not exist', async () => {
  const manifest = await Manifest.open('non-existent-project')

  assertEquals(manifest.contents, null)
  assertEquals(manifest.projectName, 'non-existent-project')
})

Deno.test('Manifest - toPath returns correct path', () => {
  const path = Manifest.toPath('test-project')

  assertEquals(path.includes('test-project'), true)
  assertEquals(path.includes('.settings'), true)
  assertEquals(path.endsWith('manifest.json'), true)
})

Deno.test('Manifest - toErrorCount returns 0 for null contents', async () => {
  const manifest = await Manifest.open('test-project')

  assertEquals(manifest.toErrorCount(), 0)
})

Deno.test('Manifest - write and refresh cycle works', async () => {
  const tempDir = await Deno.makeTempDir()
  const projectName = crypto.randomUUID()
  const manifestPath = join(tempDir, projectName, '.settings', 'manifest.json')

  // Mock toPath to use temp directory
  const originalToPath = Manifest.toPath
  Manifest.toPath = () => manifestPath

  try {
    await ensureDir(join(tempDir, projectName, '.settings'))

    const manifest = await Manifest.open(projectName)
    manifest.contents = {
      deploymentId: 'test-id',
      traceId: 'trace-id',
      spanId: 'span-id',
      files: {},
      previews: {},
      results: {},
      startAt: Date.now(),
      endAt: Date.now()
    }

    await manifest.write()

    const exists = await Manifest.exists(projectName)
    assertEquals(exists, true)

    // Refresh and verify contents
    await manifest.refresh()
    assertEquals(manifest.contents !== null, true)
    assertEquals(manifest.contents?.results, {})
  } finally {
    // Restore original method
    Manifest.toPath = originalToPath
    await Deno.remove(tempDir, { recursive: true })
  }
})
