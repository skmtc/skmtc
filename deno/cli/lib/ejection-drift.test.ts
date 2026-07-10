import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import * as v from 'valibot'
import { manifestContent, type ManifestContent } from '@skmtc/core/Manifest'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import { ejectHeadless } from '@/lib/eject-headless.ts'
import { readEjections, toEjectionsPath, writeEjections } from '@/lib/ejections.ts'
import { readEjectionState, toEjectionStatePath } from '@/lib/ejection-state.ts'
import { readGeneratedLock, toContentHash, toGeneratedLockPath } from '@/lib/generated-lock.ts'

// Drift lifecycle: run 1 generates (seeding lock + baseline cache), the
// user edits and ejects (committing the baseline), then subsequent runs
// compare B (committed baseline), P (this run's render, still present
// in artifacts for ejected items), and D (the user's disk file).

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
  projectPath: string
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
    manifest: toManifest({ 'src/user.generated.ts': '@/src/user.generated.ts' }),
    projectPath
  })

  Deno.writeTextFileSync(join(tempDir, 'src/user.generated.ts'), editedContent)

  const ejected = await ejectHeadless({
    projectName: 'my-api',
    file: 'src/user.generated.ts',
    clientSettings: {},
    skmtcRootPath
  })
  assertEquals(ejected.ok, true)

  return { tempDir, skmtcRootPath, projectPath, manifestPath }
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

Deno.test('drift - unchanged generator output is quiet', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, projectPath, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.ts': BASE },
        manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
      })

      assertEquals(result.ejections, {
        drifted: [],
        reAdoptable: [],
        stale: [],
        twinBlocked: []
      })
      assertEquals(errors.filter(msg => msg.includes('drifted')), [])

      const state = readEjectionState(toEjectionStatePath(projectPath))
      assertEquals(state.files['src/user.ts']?.state, 'quiet')

      // The user's file is untouched.
      assertEquals(Deno.readTextFileSync(join(tempDir, 'src/user.ts')), edited)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('drift - disjoint generator change reports non-overlapping drift', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, projectPath, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      // The generator now changes the LAST line — disjoint from the edit.
      const pristine = BASE.replace('export const c = 3', 'export const c = 30')

      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.ts': pristine },
        manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
      })

      assertEquals(result.ejections?.drifted, ['src/user.ts'])
      assertStringIncludes(errors.join('\n'), 'drifted behind their generators')

      const state = readEjectionState(toEjectionStatePath(projectPath))
      assertEquals(state.files['src/user.ts']?.state, 'drifted')
      assertEquals(state.files['src/user.ts']?.classification, 'non-overlapping')
      assertEquals(state.files['src/user.ts']?.reviewed, false)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('drift - both sides changing the same line reports a collision', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const b = 2', 'export const b = 200 // mine')
  const { tempDir, projectPath, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(() => {
      const pristine = BASE.replace('export const b = 2', 'export const b = 20')

      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.ts': pristine },
        manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
      })

      const state = readEjectionState(toEjectionStatePath(projectPath))
      assertEquals(state.files['src/user.ts']?.classification, 'collision')
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('drift - acknowledged drift stays quiet until output moves again', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, projectPath, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      const pristine = BASE.replace('export const c = 3', 'export const c = 30')

      // The user acknowledges this exact pristine output.
      const ejectionsPath = toEjectionsPath(manifestPath)
      const ejections = readEjections(ejectionsPath)
      ejections.files['@/src/user.ts'].reviewedPristineHash = toContentHash(pristine)
      writeEjections(ejectionsPath, ejections)

      const acknowledged = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.ts': pristine },
        manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
      })

      assertEquals(acknowledged.ejections?.drifted, [])
      assertEquals(errors.filter(msg => msg.includes('drifted')), [])
      const state = readEjectionState(toEjectionStatePath(projectPath))
      assertEquals(state.files['src/user.ts']?.reviewed, true)

      // The generator moves AGAIN — the drift resurfaces.
      const movedAgain = pristine.replace('export const c = 30', 'export const c = 300')
      const resurfaced = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.ts': movedAgain },
        manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
      })

      assertEquals(resurfaced.ejections?.drifted, ['src/user.ts'])
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('drift - a reverted edit reports re-adoptable', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, projectPath, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      // The user reverts their edit: disk now equals generated output.
      Deno.writeTextFileSync(join(tempDir, 'src/user.ts'), BASE)

      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.ts': BASE },
        manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
      })

      assertEquals(result.ejections?.reAdoptable, ['src/user.ts'])
      assertStringIncludes(errors.join('\n'), 'skmtc adopt')

      const state = readEjectionState(toEjectionStatePath(projectPath))
      assertEquals(state.files['src/user.ts']?.state, 're-adoptable')
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('drift - an ejected file no longer produced reports stale', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, projectPath, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      // The schema item was removed: no artifact at the owned path.
      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/other.generated.ts': 'export const other = 1\n' },
        manifest: toManifest({ 'src/other.generated.ts': '@/src/other.generated.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
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

Deno.test('drift - a suffixed twin from a version-skewed engine is blocked', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, projectPath, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(errors => {
      // A stale bundle (core without ejection support) emits the
      // suffixed path as if nothing were ejected.
      const result = writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/user.generated.ts': BASE },
        manifest: toManifest({ 'src/user.generated.ts': '@/src/user.generated.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
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

Deno.test('drift - a stale run preserves the ejected lock entry (adopt safety net)', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toEjectedWorkspace(edited)
  try {
    await withCapturedErrors(() => {
      // Stale run: no generator produces the ejected file.
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/other.generated.ts': 'export const other = 1\n' },
        manifest: toManifest({ 'src/other.generated.ts': '@/src/other.generated.ts' }),
        clientSettings: EJECTED_SETTINGS,
        projectPath
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
