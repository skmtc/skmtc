import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import * as v from 'valibot'
import { manifestContent, type ManifestContent } from '@skmtc/core/Manifest'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import { ejectHeadless } from '@/lib/eject-headless.ts'
import { readGeneratedLock, toGeneratedLockPath } from '@/lib/generated-lock.ts'

// Ejected-file report: each generate run compares P (this run's render,
// still present in artifacts for ejected items) against D (the user's
// disk file) live — no history, no persisted state. `re-adoptable` /
// `stale` / neither (ordinary, owned) is the whole model.

const BASE = ['export const a = 1', 'export const b = 2', 'export const c = 3'].join('\n') + '\n'

const toManifest = (files: Record<string, string>): ManifestContent =>
  v.parse(manifestContent, {
    deploymentId: 'test-deployment',
    traceId: 'test-trace',
    spanId: 'test-span',
    files: Object.fromEntries(
      Object.entries(files).map(([artifactPath, destinationPath]) => [
        artifactPath,
        { lines: 1, characters: 1, destinationPath }
      ])
    ),
    previews: {},
    parseIssues: [],
    results: {},
    startAt: Date.now(),
    endAt: Date.now()
  })

type Workspace = {
  tempDir: string
  skmtcRootPath: string
  manifestPath: string
}

/** Seeds a generated project, edits the file, and ejects it. */
const toEjectedWorkspace = async (editedContent: string): Promise<Workspace> => {
  const tempDir = await Deno.makeTempDir()
  const skmtcRootPath = join(tempDir, '.skmtc')
  const projectPath = join(skmtcRootPath, 'my-api')
  const manifestPath = join(projectPath, '.settings', 'manifest.json')

  await Deno.mkdir(join(projectPath, '.settings'), { recursive: true })
  await Deno.writeTextFile(
    join(projectPath, '.settings', 'client.json'),
    JSON.stringify({ settings: {} }, null, 2)
  )

  Deno.chdir(tempDir)

  writeGeneratedFiles({
    manifestPath,
    artifacts: { 'src/user.generated.ts': BASE },
    manifest: toManifest({ 'src/user.generated.ts': '@/src/user.generated.ts' })
  })

  Deno.writeTextFileSync(join(tempDir, 'src/user.generated.ts'), editedContent)

  const ejected = await ejectHeadless({
    projectName: 'my-api',
    file: 'src/user.generated.ts',
    clientSettings: {},
    skmtcRootPath
  })
  assertEquals(ejected.ok, true)

  return { tempDir, skmtcRootPath, manifestPath }
}

const EJECTED_SETTINGS = { ejected: ['@/src/user.ts'] }

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

Deno.test('ejection report - unchanged generator output is ordinary (owned)', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(() => {
      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.ts': BASE },
        manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
        clientSettings: EJECTED_SETTINGS
      })

      // Neither re-adoptable nor stale — an ordinary owned file, nothing
      // to report.
      assertEquals(result.ejections, {
        reAdoptable: [],
        stale: [],
        twinBlocked: []
      })

      // The user's file is untouched.
      assertEquals(Deno.readTextFileSync(join(tempDir, 'src/user.ts')), edited)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('ejection report - a reverted edit reports re-adoptable', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      // The user reverts their edit: disk now equals generated output.
      Deno.writeTextFileSync(join(tempDir, 'src/user.ts'), BASE)

      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.ts': BASE },
        manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
        clientSettings: EJECTED_SETTINGS
      })

      assertEquals(result.ejections?.reAdoptable, ['src/user.ts'])
      assertStringIncludes(errors.join('\n'), 'skmtc adopt')
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('ejection report - an ejected file no longer produced reports stale', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      // The schema item was removed: no artifact at the owned path.
      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/other.generated.ts': 'export const other = 1\n' },
        manifest: toManifest({ 'src/other.generated.ts': '@/src/other.generated.ts' }),
        clientSettings: EJECTED_SETTINGS
      })

      assertEquals(result.ejections?.stale, ['src/user.ts'])
      assertStringIncludes(errors.join('\n'), 'no longer produced')

      // The user's file survives, of course.
      assertEquals(Deno.readTextFileSync(join(tempDir, 'src/user.ts')), edited)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('ejection report - a suffixed twin from a version-skewed engine is blocked', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      // A stale bundle (core without ejection support) emits the
      // suffixed path as if nothing were ejected.
      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.generated.ts': BASE },
        manifest: toManifest({ 'src/user.generated.ts': '@/src/user.generated.ts' }),
        clientSettings: EJECTED_SETTINGS
      })

      assertEquals(result.ejections?.twinBlocked, ['src/user.generated.ts'])
      assertEquals(existsSync(join(tempDir, 'src/user.generated.ts')), false)
      assertStringIncludes(errors.join('\n'), 'refused to write')
      assertEquals(Deno.readTextFileSync(join(tempDir, 'src/user.ts')), edited)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('ejection report - a stale run preserves the ejected lock entry (adopt safety net)', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(() => {
      // Stale run: no generator produces the ejected file.
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/other.generated.ts': 'export const other = 1\n' },
        manifest: toManifest({ 'src/other.generated.ts': '@/src/other.generated.ts' }),
        clientSettings: EJECTED_SETTINGS
      })

      // The lock entry for the ejected file survives — it is what a
      // later adopt re-keys, and what post-adopt edit detection uses.
      // Regression: found by live E2E — dropping it here made the
      // post-adopt generate treat the user's file as untracked and
      // overwrite the edit.
      const lock = readGeneratedLock(toGeneratedLockPath(manifestPath))
      assertEquals(typeof lock?.files['src/user.ts']?.canonicalHash, 'string')
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})
