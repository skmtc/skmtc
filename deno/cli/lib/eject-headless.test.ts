import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import * as v from 'valibot'
import { manifestContent, type ManifestContent } from '@skmtc/core/Manifest'
import type { ClientSettings } from '@skmtc/core/Settings'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import { ejectHeadless, adoptHeadless } from '@/lib/eject-headless.ts'
import { readEjections, toEjectionsPath } from '@/lib/ejections.ts'
import { readGeneratedLock, toGeneratedLockPath } from '@/lib/generated-lock.ts'

// Eject/adopt operate on the workspace layout `generate` writes:
// `<cwd>/.skmtc/<project>/.settings/{manifest,client,generated.lock}.json`,
// artifacts at `<cwd>/<path>`. Manifest keys are on-disk paths; entry
// destinationPaths are export paths (suffixed post-injection).

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
  clientJsonPath: string
}

const toWorkspace = async (projectName: string): Promise<Workspace> => {
  const tempDir = await Deno.makeTempDir()
  const skmtcRootPath = join(tempDir, '.skmtc')
  const projectPath = join(skmtcRootPath, projectName)
  const manifestPath = join(projectPath, '.settings', 'manifest.json')
  const clientJsonPath = join(projectPath, '.settings', 'client.json')

  await Deno.mkdir(join(projectPath, '.settings'), { recursive: true })
  await Deno.writeTextFile(clientJsonPath, JSON.stringify({ settings: {} }, null, 2))

  return { tempDir, skmtcRootPath, projectPath, manifestPath, clientJsonPath }
}

const readClientEjected = (clientJsonPath: string): string[] | undefined => {
  const parsed = v.parse(
    v.object({
      settings: v.optional(v.looseObject({ ejected: v.optional(v.array(v.string())) }))
    }),
    JSON.parse(Deno.readTextFileSync(clientJsonPath))
  )
  return parsed.settings?.ejected
}

Deno.test('eject/adopt - full round trip is lossless', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath, clientJsonPath } =
    await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)

    // Generate seeds disk + lock; manifest maps the on-disk path to the
    // suffixed export path (as the engine emits post-injection).
    writeGeneratedFiles({
      manifestPath,
      artifacts: { 'src/user.generated.ts': 'export type User = { id: string }\n' },
      manifest: toManifest({ 'src/user.generated.ts': '@/src/user.generated.ts' }),
      projectPath
    })

    // The user edits, then ejects.
    const editedContent = 'export type User = { id: string; nickname: string }\n'
    Deno.writeTextFileSync(join(tempDir, 'src/user.generated.ts'), editedContent)

    const ejected = await ejectHeadless({
      projectName: 'my-api',
      file: 'src/user.generated.ts',
      clientSettings: {},
      skmtcRootPath
    })

    assertEquals(ejected.ok, true)
    if (!ejected.ok) return

    assertEquals(ejected.ownedExportPath, '@/src/user.ts')
    assertEquals(ejected.ownedArtifactPath, 'src/user.ts')

    // The rename happened, content intact.
    assertEquals(existsSync(join(tempDir, 'src/user.generated.ts')), false)
    assertEquals(Deno.readTextFileSync(join(tempDir, 'src/user.ts')), editedContent)

    // client.json carries the authoritative set; metadata is recorded;
    // the lock entry was re-keyed.
    assertEquals(readClientEjected(clientJsonPath), ['@/src/user.ts'])
    const ejections = readEjections(toEjectionsPath(manifestPath))
    assertEquals(ejections.files['@/src/user.ts']?.generatedExportPath, '@/src/user.generated.ts')
    const lock = readGeneratedLock(toGeneratedLockPath(manifestPath))
    assertEquals(typeof lock?.files['src/user.ts']?.canonicalHash, 'string')
    assertEquals(lock?.files['src/user.generated.ts'], undefined)

    // Adopt reverses everything; the user's content is never lost.
    const adopted = adoptHeadless({
      projectName: 'my-api',
      file: 'src/user.ts',
      clientSettings: { ejected: ['@/src/user.ts'] },
      skmtcRootPath
    })

    assertEquals(adopted.ok, true)
    if (!adopted.ok) return

    assertEquals(adopted.generatedArtifactPath, 'src/user.generated.ts')
    assertEquals(existsSync(join(tempDir, 'src/user.ts')), false)
    assertEquals(Deno.readTextFileSync(join(tempDir, 'src/user.generated.ts')), editedContent)
    assertEquals(readClientEjected(clientJsonPath), undefined)
    assertEquals(readEjections(toEjectionsPath(manifestPath)).files['@/src/user.ts'], undefined)
    const lockAfter = readGeneratedLock(toGeneratedLockPath(manifestPath))
    assertEquals(typeof lockAfter?.files['src/user.generated.ts']?.canonicalHash, 'string')
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('eject - collision pre-flight blocks ejecting onto an existing file', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)

    writeGeneratedFiles({
      manifestPath,
      artifacts: { 'src/user.generated.ts': 'export type User = {}\n' },
      manifest: toManifest({ 'src/user.generated.ts': '@/src/user.generated.ts' }),
      projectPath
    })

    // A hand-written file already sits at the owned name.
    Deno.writeTextFileSync(join(tempDir, 'src/user.ts'), '// hand-written module\n')

    const result = await ejectHeadless({
      projectName: 'my-api',
      file: 'src/user.generated.ts',
      clientSettings: {},
      skmtcRootPath
    })

    assertEquals(result.ok, false)
    if (result.ok) return
    assertStringIncludes(result.reason, 'already exists')

    // Nothing moved, nothing recorded.
    assertEquals(existsSync(join(tempDir, 'src/user.generated.ts')), true)
    assertEquals(Deno.readTextFileSync(join(tempDir, 'src/user.ts')), '// hand-written module\n')
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('eject - untracked and already-ejected files are refused', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)

    writeGeneratedFiles({
      manifestPath,
      artifacts: { 'src/user.generated.ts': 'export type User = {}\n' },
      manifest: toManifest({ 'src/user.generated.ts': '@/src/user.generated.ts' }),
      projectPath
    })

    const untracked = await ejectHeadless({
      projectName: 'my-api',
      file: 'src/not-generated.ts',
      clientSettings: {},
      skmtcRootPath
    })
    assertEquals(untracked.ok, false)

    const clientSettings: ClientSettings = { ejected: ['@/src/user.ts'] }
    const repeated = await ejectHeadless({
      projectName: 'my-api',
      file: 'src/user.generated.ts',
      clientSettings,
      skmtcRootPath
    })
    assertEquals(repeated.ok, false)
    if (repeated.ok) return
    assertStringIncludes(repeated.reason, 'already ejected')
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('adopt - refuses a file that is not in the ejected set', async () => {
  const { tempDir, skmtcRootPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)

    const result = adoptHeadless({
      projectName: 'my-api',
      file: 'src/user.ts',
      clientSettings: {},
      skmtcRootPath
    })

    assertEquals(result.ok, false)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})
