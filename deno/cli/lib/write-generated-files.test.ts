import { assertEquals, assertStringIncludes } from '@std/assert'
import { deletePreviousArtifacts, writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import { readGeneratedLock, toGeneratedLockPath } from '@/lib/generated-lock.ts'
import { manifestContent } from '@skmtc/core/Manifest'
import * as v from 'valibot'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'

// Helper to create a valid manifest structure
const createManifest = (files: Record<string, unknown>) => ({
  deploymentId: 'test-deployment',
  traceId: 'test-trace',
  spanId: 'test-span',
  region: 'us-east-1',
  files,
  previews: {},
  mappings: {},
  parseIssues: [],
  results: {},
  startAt: Date.now(),
  endAt: Date.now()
})

Deno.test('deletePreviousArtifacts - does nothing when manifest does not exist', async () => {
  const tempDir = await Deno.makeTempDir()
  try {
    const manifestPath = join(tempDir, 'manifest.json')
    const incomingPaths = ['src/api.ts']

    // Should not throw when manifest doesn't exist
    deletePreviousArtifacts({
      skmtcRootPath: tempDir,
      manifestPath,
      incomingPaths
    })

    // Verify no files were deleted (since manifest didn't exist)
    assertEquals(true, true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - deletes files not in incoming paths', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    // Create directory structure: tempDir/skmtc/manifest.json and tempDir/old-file.ts
    const skmtcDir = join(tempDir, 'skmtc')
    await Deno.mkdir(skmtcDir)

    const manifestPath = join(skmtcDir, 'manifest.json')
    const oldFilePath = join(tempDir, 'old-file.ts')

    // Create old file that should be deleted
    await Deno.writeTextFile(oldFilePath, 'old content')

    // Create manifest that references the old file
    const manifest = createManifest({
      'old-file.ts': { lines: 10, characters: 100, destinationPath: 'old-file.ts' }
    })
    await Deno.writeTextFile(manifestPath, JSON.stringify(manifest))

    // Delete artifacts - incoming paths don't include old-file.ts
    // skmtcRootPath is skmtcDir, so join(skmtcDir, '..', 'old-file.ts') = tempDir/old-file.ts
    deletePreviousArtifacts({
      skmtcRootPath: skmtcDir,
      manifestPath,
      incomingPaths: ['new-file.ts']
    })

    // Verify old file was deleted
    const exists = await Deno.stat(oldFilePath)
      .then(() => true)
      .catch(() => false)
    assertEquals(exists, false)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - keeps files that are in incoming paths', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const skmtcDir = join(tempDir, 'skmtc')
    await Deno.mkdir(skmtcDir)

    const manifestPath = join(skmtcDir, 'manifest.json')
    const keepFilePath = join(tempDir, 'keep-file.ts')

    // Create file that should be kept
    await Deno.writeTextFile(keepFilePath, 'keep this')

    // Create manifest
    const manifest = createManifest({
      'keep-file.ts': { lines: 5, characters: 50, destinationPath: 'keep-file.ts' }
    })
    await Deno.writeTextFile(manifestPath, JSON.stringify(manifest))

    // Delete artifacts - incoming paths include keep-file.ts
    deletePreviousArtifacts({
      skmtcRootPath: skmtcDir,
      manifestPath,
      incomingPaths: ['keep-file.ts']
    })

    // Verify file still exists
    const exists = await Deno.stat(keepFilePath)
      .then(() => true)
      .catch(() => false)
    assertEquals(exists, true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - handles multiple files correctly', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const skmtcDir = join(tempDir, 'skmtc')
    await Deno.mkdir(skmtcDir)

    const manifestPath = join(skmtcDir, 'manifest.json')
    const deleteFile1 = join(tempDir, 'delete1.ts')
    const deleteFile2 = join(tempDir, 'delete2.ts')
    const keepFile = join(tempDir, 'keep.ts')

    // Create files
    await Deno.writeTextFile(deleteFile1, 'delete 1')
    await Deno.writeTextFile(deleteFile2, 'delete 2')
    await Deno.writeTextFile(keepFile, 'keep')

    // Create manifest with all files
    const manifest = createManifest({
      'delete1.ts': { lines: 1, characters: 10, destinationPath: 'delete1.ts' },
      'delete2.ts': { lines: 1, characters: 10, destinationPath: 'delete2.ts' },
      'keep.ts': { lines: 1, characters: 10, destinationPath: 'keep.ts' }
    })
    await Deno.writeTextFile(manifestPath, JSON.stringify(manifest))

    // Delete artifacts - only keep keep.ts
    deletePreviousArtifacts({
      skmtcRootPath: skmtcDir,
      manifestPath,
      incomingPaths: ['keep.ts']
    })

    // Verify correct files were deleted/kept
    const delete1Exists = await Deno.stat(deleteFile1)
      .then(() => true)
      .catch(() => false)
    const delete2Exists = await Deno.stat(deleteFile2)
      .then(() => true)
      .catch(() => false)
    const keepExists = await Deno.stat(keepFile)
      .then(() => true)
      .catch(() => false)

    assertEquals(delete1Exists, false)
    assertEquals(delete2Exists, false)
    assertEquals(keepExists, true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - handles empty manifest gracefully', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const manifestPath = join(tempDir, 'manifest.json')

    // Create manifest with no files
    const manifest = createManifest({})
    await Deno.writeTextFile(manifestPath, JSON.stringify(manifest))

    // Should not throw with empty manifest
    deletePreviousArtifacts({
      skmtcRootPath: tempDir,
      manifestPath,
      incomingPaths: []
    })

    assertEquals(true, true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - ignores errors when deleting non-existent files', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const manifestPath = join(tempDir, 'manifest.json')

    // Create manifest that references non-existent file
    const manifest = createManifest({
      'non-existent.ts': { lines: 10, characters: 100, destinationPath: 'non-existent.ts' }
    })
    await Deno.writeTextFile(manifestPath, JSON.stringify(manifest))

    // Should not throw even though file doesn't exist
    deletePreviousArtifacts({
      skmtcRootPath: tempDir,
      manifestPath,
      incomingPaths: []
    })

    assertEquals(true, true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - handles nested directory paths', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const skmtcDir = join(tempDir, 'skmtc')
    await Deno.mkdir(skmtcDir)

    const manifestPath = join(skmtcDir, 'manifest.json')
    const nestedDir = join(tempDir, 'src', 'api')
    await Deno.mkdir(nestedDir, { recursive: true })

    const nestedFile = join(nestedDir, 'handler.ts')
    await Deno.writeTextFile(nestedFile, 'handler code')

    // Create manifest with nested path
    const manifest = createManifest({
      'src/api/handler.ts': { lines: 10, characters: 100, destinationPath: 'src/api/handler.ts' }
    })
    await Deno.writeTextFile(manifestPath, JSON.stringify(manifest))

    // Delete the nested file
    deletePreviousArtifacts({
      skmtcRootPath: skmtcDir,
      manifestPath,
      incomingPaths: []
    })

    // Verify nested file was deleted
    const exists = await Deno.stat(nestedFile)
      .then(() => true)
      .catch(() => false)
    assertEquals(exists, false)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - refuses to delete a path that escapes the app root', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    // App root is tempDir/app; the victim sits one level above it. A
    // manifest key with a `..` segment must be refused, not deleted.
    const appRoot = join(tempDir, 'app')
    const skmtcDir = join(appRoot, 'skmtc')
    await Deno.mkdir(skmtcDir, { recursive: true })

    const manifestPath = join(skmtcDir, 'manifest.json')
    const escapePath = join(tempDir, 'escape.ts')
    await Deno.writeTextFile(escapePath, 'outside the app root')

    const manifest = createManifest({
      '../escape.ts': { lines: 1, characters: 20, destinationPath: '../escape.ts' }
    })
    await Deno.writeTextFile(manifestPath, JSON.stringify(manifest))

    deletePreviousArtifacts({
      skmtcRootPath: skmtcDir,
      manifestPath,
      incomingPaths: []
    })

    assertEquals(existsSync(escapePath), true)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - skips cleanup gracefully when manifest is stale-schema', async () => {
  // Same tolerance contract as `Manifest.open` — a stale manifest
  // shouldn't abort the generate run. Here we verify the
  // sync-codepath version of that behavior: the function logs a
  // warning on stderr and returns without throwing or deleting
  // any user files.
  const tempDir = await Deno.makeTempDir()
  const errors: string[] = []
  const originalError = console.error
  console.error = (msg: string) => errors.push(msg)

  try {
    const skmtcDir = join(tempDir, 'skmtc')
    await Deno.mkdir(skmtcDir)

    const manifestPath = join(skmtcDir, 'manifest.json')
    const oldFilePath = join(tempDir, 'old-file.ts')
    await Deno.writeTextFile(oldFilePath, 'should not be touched')

    // Stale-schema manifest: missing `parseIssues`.
    await Deno.writeTextFile(
      manifestPath,
      JSON.stringify({
        deploymentId: 'stale',
        traceId: 'stale',
        spanId: 'stale',
        files: {
          'old-file.ts': { lines: 1, characters: 1, destinationPath: 'old-file.ts' }
        },
        previews: {},
        results: {},
        startAt: 0,
        endAt: 0
      })
    )

    deletePreviousArtifacts({
      skmtcRootPath: skmtcDir,
      manifestPath,
      incomingPaths: []
    })

    // File should NOT be deleted — we couldn't trust the manifest.
    const stillExists = await Deno.stat(oldFilePath)
      .then(() => true)
      .catch(() => false)
    assertEquals(stillExists, true)
    assertEquals(errors.length, 1)
  } finally {
    console.error = originalError
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('deletePreviousArtifacts - skips cleanup gracefully when manifest has malformed JSON', async () => {
  const tempDir = await Deno.makeTempDir()
  const errors: string[] = []
  const originalError = console.error
  console.error = (msg: string) => errors.push(msg)

  try {
    const skmtcDir = join(tempDir, 'skmtc')
    await Deno.mkdir(skmtcDir)
    const manifestPath = join(skmtcDir, 'manifest.json')
    await Deno.writeTextFile(manifestPath, '{not actually json')

    // Should not throw
    deletePreviousArtifacts({
      skmtcRootPath: skmtcDir,
      manifestPath,
      incomingPaths: []
    })

    assertEquals(errors.length, 1)
  } finally {
    console.error = originalError
    await Deno.remove(tempDir, { recursive: true })
  }
})

// --- writeGeneratedFiles: changed-only writes ------------------------------
// Render output is deterministic, so most files are unchanged between runs.
// writeGeneratedFiles must skip rewriting byte-identical files so file-watch
// consumers (Vite HMR under the preview harness, `skmtc dev`) don't re-process
// every file on every regenerate. We prove "did not rewrite" by stamping the
// file's mtime into the past and asserting it survives an identical regenerate.
//
// writeGeneratedFiles resolves its output root from toRootPath(), which — outside
// $HOME (a temp dir) — falls back to `<cwd>/.skmtc`, so artifacts land at
// `<cwd>/<path>`. chdir into the temp dir to control that root.
const PAST = new Date('2000-01-01T00:00:00Z')

const manifestFor = (path: string) =>
  v.parse(
    manifestContent,
    createManifest({ [path]: { lines: 1, characters: 1, destinationPath: path } })
  )

Deno.test('writeGeneratedFiles - skips rewriting a file whose content is unchanged', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    const manifestPath = join(tempDir, 'manifest.json')
    const artifactPath = join(tempDir, 'out.ts')
    const manifest = manifestFor('out.ts')
    const content = 'export const a = 1\n'

    writeGeneratedFiles({ manifestPath, artifacts: { 'out.ts': content }, manifest })
    assertEquals(Deno.readTextFileSync(artifactPath), content)

    // Stamp mtime into the past; an identical regenerate must NOT touch the file.
    Deno.utimeSync(artifactPath, PAST, PAST)
    writeGeneratedFiles({ manifestPath, artifacts: { 'out.ts': content }, manifest })

    assertEquals(Deno.statSync(artifactPath).mtime?.getTime(), PAST.getTime())
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeGeneratedFiles - rewrites a file whose content changed', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    const manifestPath = join(tempDir, 'manifest.json')
    const artifactPath = join(tempDir, 'out.ts')
    const manifest = manifestFor('out.ts')

    writeGeneratedFiles({ manifestPath, artifacts: { 'out.ts': 'export const a = 1\n' }, manifest })
    Deno.utimeSync(artifactPath, PAST, PAST)

    // Different content → the file is rewritten (content updates, mtime advances).
    writeGeneratedFiles({ manifestPath, artifacts: { 'out.ts': 'export const a = 2\n' }, manifest })

    assertEquals(Deno.readTextFileSync(artifactPath), 'export const a = 2\n')
    assertEquals(Deno.statSync(artifactPath).mtime?.getTime() === PAST.getTime(), false)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

// --- writeGeneratedFiles: engine ownership ---------------------------------
// Generated files are engine-owned: every run converges the on-disk tree to
// this run's render, hand edits included. The lock is a write-avoidance
// cache only (byte-identical and unchanged-formatted skips keep mtimes
// stable) — it never blocks an overwrite, and `protectedPaths` is always
// empty. Ejection (`settings.ejected`) is the one sanctioned way to own a
// file.

/** Runs a test body with console.error captured (formatter warnings land on stderr). */
const withCapturedErrors = async (
  body: (errors: string[]) => Promise<void> | void
): Promise<void> => {
  const errors: string[] = []
  const originalError = console.error
  console.error = (msg: string) => errors.push(msg)
  try {
    await body(errors)
  } finally {
    console.error = originalError
  }
}

Deno.test('writeGeneratedFiles - overwrites a hand-edited file', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await withCapturedErrors(errors => {
      const manifestPath = join(tempDir, 'manifest.json')
      const artifactPath = join(tempDir, 'out.ts')
      const manifest = manifestFor('out.ts')

      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': 'export const a = 1\n' },
        manifest
      })

      // The user edits the generated file by hand — generated files are
      // engine-owned, so the next run overwrites the edit.
      Deno.writeTextFileSync(artifactPath, 'export const a = 1 // patched by hand\n')

      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': 'export const a = 2\n' },
        manifest
      })

      assertEquals(Deno.readTextFileSync(artifactPath), 'export const a = 2\n')
      assertEquals(result.protectedPaths, [])
      assertEquals(
        errors.filter(msg => msg.includes('manual edits')),
        []
      )
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeGeneratedFiles - prunes a stale file even when hand-edited', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await withCapturedErrors(() => {
      const manifestPath = join(tempDir, 'manifest.json')
      const oldPath = join(tempDir, 'old.ts')
      const newPath = join(tempDir, 'new.ts')

      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'old.ts': 'export const old = 1\n' },
        manifest: manifestFor('old.ts')
      })

      Deno.writeTextFileSync(oldPath, 'export const old = 1 // keep me\n')

      // Next run no longer produces old.ts — it is pruned regardless of the
      // edit. Ejection is the sanctioned way to keep a generated file.
      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'new.ts': 'export const fresh = 1\n' },
        manifest: manifestFor('new.ts')
      })

      assertEquals(existsSync(oldPath), false)
      assertEquals(Deno.readTextFileSync(newPath), 'export const fresh = 1\n')
      assertEquals(result.protectedPaths, [])

      // The pruned file's lock entry is dropped with it.
      const lock = readGeneratedLock(toGeneratedLockPath(manifestPath))
      assertEquals(lock?.files['old.ts'], undefined)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeGeneratedFiles - overwrites pre-existing untracked files and seeds the lock', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await withCapturedErrors(() => {
      const manifestPath = join(tempDir, 'manifest.json')
      const artifactPath = join(tempDir, 'out.ts')
      const manifest = manifestFor('out.ts')

      // No lock yet (fresh clone / first run): the file is overwritten and
      // the lock is seeded for the write-avoidance skips.
      Deno.writeTextFileSync(artifactPath, 'export const a = 0 // pre-existing content\n')

      const first = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': 'export const a = 1\n' },
        manifest
      })
      assertEquals(first.protectedPaths, [])
      assertEquals(Deno.readTextFileSync(artifactPath), 'export const a = 1\n')

      const lock = readGeneratedLock(toGeneratedLockPath(manifestPath))
      assertEquals(typeof lock?.files['out.ts']?.canonicalHash, 'string')
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

// --- writeGeneratedFiles: formatter integration ----------------------------
// `deno fmt` serves as the test formatter: always present in CI, formats
// explicit dot-prefixed paths, and `--options-single-quote` provides a
// second "formatter config" for the drift tests. Canonical render output
// below is single-quote/no-semicolon; `deno fmt` (default) rewrites it to
// double-quote/semicolon.

const canonical = `export const a = 'x'\n`
const formattedDouble = `export const a = "x";\n`
const formattedSingle = `export const a = 'x';\n`

Deno.test('writeGeneratedFiles - formats written files and stays quiet on unchanged reruns', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await withCapturedErrors(() => {
      const manifestPath = join(tempDir, 'manifest.json')
      const artifactPath = join(tempDir, 'out.ts')
      const manifest = manifestFor('out.ts')
      const clientSettings = { formatter: 'deno fmt' }

      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings
      })
      assertEquals(Deno.readTextFileSync(artifactPath), formattedDouble)

      // Rerun with identical canonical output: the formatted file must be
      // recognized as clean and unchanged — no rewrite, no protect.
      Deno.utimeSync(artifactPath, PAST, PAST)
      const rerun = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings
      })

      assertEquals(rerun.protectedPaths, [])
      assertEquals(Deno.statSync(artifactPath).mtime?.getTime(), PAST.getTime())
      assertEquals(Deno.readTextFileSync(artifactPath), formattedDouble)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeGeneratedFiles - a formatter config change converges after the repo reformat', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await withCapturedErrors(() => {
      const manifestPath = join(tempDir, 'manifest.json')
      const artifactPath = join(tempDir, 'out.ts')
      const manifest = manifestFor('out.ts')
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings: { formatter: 'deno fmt' }
      })
      assertEquals(Deno.readTextFileSync(artifactPath), formattedDouble)

      // Config change alone, render and disk untouched: the unchanged-render
      // skip still applies — the file keeps the old style for now (lazy).
      Deno.utimeSync(artifactPath, PAST, PAST)
      const lazy = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings: { formatter: 'deno fmt --options-single-quote' }
      })
      assertEquals(lazy.protectedPaths, [])
      assertEquals(Deno.statSync(artifactPath).mtime?.getTime(), PAST.getTime())

      // The user reformats the repo under the new config (the usual next
      // step): disk no longer matches the recorded state, so the next run
      // rewrites and re-formats — converging on the new style.
      Deno.writeTextFileSync(artifactPath, formattedSingle)
      const rerun = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings: { formatter: 'deno fmt --options-single-quote' }
      })
      assertEquals(rerun.protectedPaths, [])
      assertEquals(Deno.readTextFileSync(artifactPath), formattedSingle)

      // The new formatted state is recorded: the next run skips the write.
      Deno.utimeSync(artifactPath, PAST, PAST)
      const third = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings: { formatter: 'deno fmt --options-single-quote' }
      })
      assertEquals(third.protectedPaths, [])
      assertEquals(Deno.statSync(artifactPath).mtime?.getTime(), PAST.getTime())
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeGeneratedFiles - a hand edit under a formatter is overwritten', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await withCapturedErrors(() => {
      const manifestPath = join(tempDir, 'manifest.json')
      const artifactPath = join(tempDir, 'out.ts')
      const manifest = manifestFor('out.ts')
      const clientSettings = { formatter: 'deno fmt' }

      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings
      })

      // A semantic edit in the formatted file — overwritten and re-formatted
      // on the next run like any other divergence.
      const edited = `${formattedDouble}export const b = 2;\n`
      Deno.writeTextFileSync(artifactPath, edited)

      const rerun = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings
      })

      assertEquals(rerun.protectedPaths, [])
      assertEquals(Deno.readTextFileSync(artifactPath), formattedDouble)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('writeGeneratedFiles - formatter failure degrades gracefully', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await withCapturedErrors(errors => {
      const manifestPath = join(tempDir, 'manifest.json')
      const artifactPath = join(tempDir, 'out.ts')
      const manifest = manifestFor('out.ts')

      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings: { formatter: 'false' }
      })

      // Files land unformatted, nothing is destroyed, the failure is reported.
      assertEquals(result.protectedPaths, [])
      assertEquals(Deno.readTextFileSync(artifactPath), canonical)
      assertStringIncludes(errors.join('\n'), 'formatter command failed')

      // Follow-up runs treat the unformatted content as the recorded state.
      Deno.utimeSync(artifactPath, PAST, PAST)
      const rerun = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': canonical },
        manifest,
        clientSettings: { formatter: 'false' }
      })
      assertEquals(rerun.protectedPaths, [])
      assertEquals(Deno.statSync(artifactPath).mtime?.getTime(), PAST.getTime())
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

// --- writeGeneratedFiles: ejected files ------------------------------------
// An ejected file (client.json#settings.ejected, suffix-less export
// paths) is user-owned: the engine still renders it (drift input), but
// the host never writes it, never deletes it, and marks it in the
// manifest. Ejection is declared intent — the one way to own a file.

Deno.test('writeGeneratedFiles - never writes or deletes an ejected file', async () => {
  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await withCapturedErrors(errors => {
      const manifestPath = join(tempDir, 'manifest.json')
      const artifactPath = join(tempDir, 'out.ts')
      const manifest = manifestFor('out.ts')

      // Run 1: normal generation seeds disk + lock.
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': 'export const a = 1\n' },
        manifest
      })

      // The user edits and ejects the file.
      Deno.writeTextFileSync(artifactPath, 'export const a = 1 // mine now\n')
      const clientSettings = { ejected: ['@/out.ts'] }

      // Run 2: the engine still renders the item (new content), but the
      // host must not touch the user's file — and this is ejection, not
      // protection, so no protect warning fires.
      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'out.ts': 'export const a = 2\n' },
        manifest: manifestFor('out.ts'),
        clientSettings
      })

      assertEquals(Deno.readTextFileSync(artifactPath), 'export const a = 1 // mine now\n')
      assertEquals(result.protectedPaths, [])
      assertEquals(
        errors.filter(msg => msg.includes('manual edits')),
        []
      )

      // The manifest on disk marks the entry as ejected.
      const manifestOnDisk = JSON.parse(Deno.readTextFileSync(manifestPath))
      assertEquals(manifestOnDisk.files['out.ts'].ejected, true)

      // Run 3: the item vanishes from the artifacts entirely (generator
      // removed) — the prune must still spare the user's file.
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'other.ts': 'export const b = 1\n' },
        manifest: manifestFor('other.ts'),
        clientSettings
      })
      assertEquals(Deno.readTextFileSync(artifactPath), 'export const a = 1 // mine now\n')
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})
