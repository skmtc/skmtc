import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
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

/**
 * Captures stderr writes for the duration of `fn`. The tolerant
 * manifest reader logs degraded-recovery warnings via `console.error`
 * (so they don't pollute `--json` consumers on stdout); the tests
 * assert on those messages.
 */
const captureStderr = async (fn: () => Promise<void>): Promise<string[]> => {
  const original = console.error
  const messages: string[] = []
  console.error = (msg: string) => messages.push(msg)
  try {
    await fn()
  } finally {
    console.error = original
  }
  return messages
}

Deno.test('Manifest - open tolerates a stale-schema manifest', async () => {
  // The manifest on disk is shaped like the @skmtc/core schema from a
  // previous version — missing the new `parseIssues` field that the
  // current valibot schema requires. Manifest.open used to throw a
  // ConfigValidationError, which aborted SkmtcRoot.open and blocked
  // every other agent-mode command. Now it should degrade to
  // `contents: null` and warn on stderr.
  const tempDir = await Deno.makeTempDir()
  const projectName = crypto.randomUUID()
  const manifestPath = join(tempDir, projectName, '.settings', 'manifest.json')
  const originalToPath = Manifest.toPath
  Manifest.toPath = () => manifestPath

  try {
    await ensureDir(join(tempDir, projectName, '.settings'))
    // Write a manifest missing the `parseIssues` field that the
    // current schema declares as required.
    await Deno.writeTextFile(
      manifestPath,
      JSON.stringify({
        deploymentId: 'stale',
        traceId: 'stale',
        spanId: 'stale',
        files: {},
        previews: {},
        results: {},
        startAt: 0,
        endAt: 0
      })
    )

    let manifest: Manifest | undefined
    const warnings = await captureStderr(async () => {
      manifest = await Manifest.open(projectName)
    })

    assertEquals(manifest?.contents, null)
    assertEquals(warnings.length, 1)
    assertStringIncludes(warnings[0], 'doesn\'t match the current schema')
    assertStringIncludes(warnings[0], manifestPath)
  } finally {
    Manifest.toPath = originalToPath
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('Manifest - open tolerates a manifest with malformed JSON', async () => {
  // A truncated write or hand-edit can produce invalid JSON. Same
  // recovery as the stale-schema case: drop to null + warn.
  const tempDir = await Deno.makeTempDir()
  const projectName = crypto.randomUUID()
  const manifestPath = join(tempDir, projectName, '.settings', 'manifest.json')
  const originalToPath = Manifest.toPath
  Manifest.toPath = () => manifestPath

  try {
    await ensureDir(join(tempDir, projectName, '.settings'))
    await Deno.writeTextFile(manifestPath, '{not actually json')

    let manifest: Manifest | undefined
    const warnings = await captureStderr(async () => {
      manifest = await Manifest.open(projectName)
    })

    assertEquals(manifest?.contents, null)
    assertEquals(warnings.length, 1)
    assertStringIncludes(warnings[0], 'invalid JSON')
    assertStringIncludes(warnings[0], manifestPath)
  } finally {
    Manifest.toPath = originalToPath
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('Manifest - refresh also tolerates a stale-schema manifest', async () => {
  // Same contract as `open`, exercised through the refresh path that
  // `SkmtcRoot.open` and `Project.refreshManifest` go through.
  const tempDir = await Deno.makeTempDir()
  const projectName = crypto.randomUUID()
  const manifestPath = join(tempDir, projectName, '.settings', 'manifest.json')
  const originalToPath = Manifest.toPath
  Manifest.toPath = () => manifestPath

  try {
    await ensureDir(join(tempDir, projectName, '.settings'))

    // Start with a good manifest.
    const manifest = await Manifest.open(projectName)
    manifest.contents = {
      deploymentId: 'fresh',
      traceId: 'fresh',
      spanId: 'fresh',
      files: {},
      previews: {},
      parseIssues: [],
      results: {},
      startAt: Date.now(),
      endAt: Date.now()
    }
    await manifest.write()

    // Stomp it with a stale-schema payload underneath.
    await Deno.writeTextFile(
      manifestPath,
      JSON.stringify({
        deploymentId: 'stale',
        traceId: 'stale',
        spanId: 'stale',
        files: {},
        previews: {},
        results: {},
        startAt: 0,
        endAt: 0
      })
    )

    const warnings = await captureStderr(async () => {
      await manifest.refresh()
    })

    assertEquals(manifest.contents, null)
    assertEquals(warnings.length, 1)
    assertStringIncludes(warnings[0], 'doesn\'t match the current schema')
  } finally {
    Manifest.toPath = originalToPath
    await Deno.remove(tempDir, { recursive: true })
  }
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
      parseIssues: [],
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
