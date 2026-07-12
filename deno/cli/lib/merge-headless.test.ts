import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import * as v from 'valibot'
import { manifestContent, type ManifestContent } from '@skmtc/core/Manifest'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import { ejectHeadless } from '@/lib/eject-headless.ts'
import { mergeHeadless } from '@/lib/merge-headless.ts'
import { readEjections, toEjectionsPath } from '@/lib/ejections.ts'
import { readEjectionState, toEjectionStatePath } from '@/lib/ejection-state.ts'
import { toContentHash } from '@/lib/generated-lock.ts'

// Merge lifecycle: generate → edit → eject → the generator moves →
// generate again (persists the pristine render + reports drift) →
// merge folds the generator's changes in while keeping the edit.

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

const EJECTED_SETTINGS = { ejected: ['@/src/user.ts'] }

type Workspace = {
  tempDir: string
  skmtcRootPath: string
  projectPath: string
  manifestPath: string
}

/** Generate → edit → eject → regenerate with `pristine` (persisting the render). */
const toDriftedWorkspace = async (editedContent: string, pristine: string): Promise<Workspace> => {
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

  const originalError = console.error
  console.error = () => {}
  try {
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

    writeGeneratedFiles({
      manifestPath,
      artifacts: { 'src/user.ts': pristine },
      manifest: toManifest({ 'src/user.ts': '@/src/user.ts' }),
      clientSettings: EJECTED_SETTINGS,
      projectPath
    })
  } finally {
    console.error = originalError
  }

  return { tempDir, skmtcRootPath, projectPath, manifestPath }
}

Deno.test('merge - folds non-overlapping generator changes into the edited file', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const pristine = BASE.replace('export const c = 3', 'export const c = 30')
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toDriftedWorkspace(
    edited,
    pristine
  )
  try {
    const result = mergeHeadless({
      projectName: 'my-api',
      file: 'src/user.ts',
      clientSettings: EJECTED_SETTINGS,
      skmtcRootPath
    })

    assertEquals(result.ok, true)
    if (!result.ok) return
    assertEquals(result.upToDate, false)

    // Both the user's edit and the generator's change are present.
    assertEquals(
      Deno.readTextFileSync(join(tempDir, 'src/user.ts')),
      ['export const a = 100 // mine', 'export const b = 2', 'export const c = 30'].join('\n') +
        '\n'
    )

    // The baseline advanced to the pristine render; no reviewed hash remains.
    const record = readEjections(toEjectionsPath(manifestPath)).files['@/src/user.ts']
    assertEquals(record?.baselineHash, toContentHash(pristine))
    assertEquals(record?.reviewedPristineHash, undefined)

    // The drift state is resolved.
    const state = readEjectionState(toEjectionStatePath(projectPath))
    assertEquals(state.files['src/user.ts']?.state, 'quiet')

    // A second merge is a no-op.
    const again = mergeHeadless({
      projectName: 'my-api',
      file: 'src/user.ts',
      clientSettings: EJECTED_SETTINGS,
      skmtcRootPath
    })
    assertEquals(again.ok, true)
    if (!again.ok) return
    assertEquals(again.upToDate, true)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('merge - refuses collisions whole, leaving the file untouched', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const b = 2', 'export const b = 200 // mine')
  const pristine = BASE.replace('export const b = 2', 'export const b = 20')
  const { tempDir, skmtcRootPath } = await toDriftedWorkspace(edited, pristine)
  try {
    const result = mergeHeadless({
      projectName: 'my-api',
      file: 'src/user.ts',
      clientSettings: EJECTED_SETTINGS,
      skmtcRootPath
    })

    assertEquals(result.ok, false)
    if (result.ok) return
    assertStringIncludes(result.reason, 'collide')
    assertEquals(result.collisions, [{ start: 1, end: 2 }])

    // Nothing was written — no conflict markers, no partial merge.
    assertEquals(Deno.readTextFileSync(join(tempDir, 'src/user.ts')), edited)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('merge - refuses a file that is not ejected or has no pristine render', async () => {
  const originalCwd = Deno.cwd()
  const edited = BASE.replace('export const a = 1', 'export const a = 100 // mine')
  const { tempDir, skmtcRootPath, projectPath } = await toDriftedWorkspace(edited, BASE)
  try {
    const notEjected = mergeHeadless({
      projectName: 'my-api',
      file: 'src/other.ts',
      clientSettings: EJECTED_SETTINGS,
      skmtcRootPath
    })
    assertEquals(notEjected.ok, false)

    // Remove the persisted pristine render — merge must ask for a generate.
    await Deno.remove(join(projectPath, '.baselines', 'pristine'), { recursive: true })
    const noPristine = mergeHeadless({
      projectName: 'my-api',
      file: 'src/user.ts',
      clientSettings: EJECTED_SETTINGS,
      skmtcRootPath
    })
    assertEquals(noPristine.ok, false)
    if (noPristine.ok) return
    assertStringIncludes(noPristine.reason, 'skmtc generate')
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})
