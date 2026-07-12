import { assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import * as v from 'valibot'
import { manifestContent, type ManifestContent } from '@skmtc/core/Manifest'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import { toContentHash, toGeneratedLockPath } from '@/lib/generated-lock.ts'
import { statusHeadless } from '@/lib/status-headless.ts'

// statusHeadless reads the same workspace layout `generate` writes:
// `<cwd>/.skmtc/<project>/.settings/manifest.json` + generated.lock.json,
// artifacts at `<cwd>/<path>`. Each test seeds state through
// writeGeneratedFiles (chdir'd into a temp dir) so status is exercised
// against the real writer's output, not hand-built fixtures.

const toManifest = (paths: string[]): ManifestContent =>
  v.parse(manifestContent, {
    deploymentId: 'test-deployment',
    traceId: 'test-trace',
    spanId: 'test-span',
    files: Object.fromEntries(
      paths.map(path => [path, { lines: 1, characters: 1, destinationPath: path }])
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

const toWorkspace = async (projectName: string): Promise<Workspace> => {
  const tempDir = await Deno.makeTempDir()
  const skmtcRootPath = join(tempDir, '.skmtc')
  const projectPath = join(skmtcRootPath, projectName)
  const manifestPath = join(projectPath, '.settings', 'manifest.json')

  return { tempDir, skmtcRootPath, projectPath, manifestPath }
}

const silenced = async (body: () => Promise<void> | void): Promise<void> => {
  const originalError = console.error
  console.error = () => {}
  try {
    await body()
  } finally {
    console.error = originalError
  }
}

Deno.test('statusHeadless - no manifest reports noManifest and clean', async () => {
  const { tempDir, skmtcRootPath } = await toWorkspace('my-api')
  try {
    const result = await statusHeadless({
      projectName: 'my-api',
      clientSettings: undefined,
      skmtcRootPath
    })

    assertEquals(result.noManifest, true)
    assertEquals(result.clean, true)
    assertEquals(result.files, [])
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('statusHeadless - classifies clean, modified, and missing files', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await silenced(async () => {
      writeGeneratedFiles({
        manifestPath,
        artifacts: {
          'src/clean.ts': 'export const clean = 1\n',
          'src/edited.ts': 'export const edited = 1\n',
          'src/gone.ts': 'export const gone = 1\n'
        },
        manifest: toManifest(['src/clean.ts', 'src/edited.ts', 'src/gone.ts']),
        projectPath
      })

      Deno.writeTextFileSync(join(tempDir, 'src/edited.ts'), 'export const edited = 1 // mine\n')
      Deno.removeSync(join(tempDir, 'src/gone.ts'))

      const result = await statusHeadless({
        projectName: 'my-api',
        clientSettings: undefined,
        skmtcRootPath
      })

      assertEquals(result.noManifest, false)
      assertEquals(result.counts, { clean: 1, modified: 1, missing: 1, unverified: 0, ejected: 0 })
      assertEquals(result.files.find(({ path }) => path === 'src/clean.ts')?.status, 'clean')
      assertEquals(result.files.find(({ path }) => path === 'src/edited.ts')?.status, 'modified')
      assertEquals(result.files.find(({ path }) => path === 'src/gone.ts')?.status, 'missing')
      assertEquals(result.clean, false)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('statusHeadless - files without a lock entry are unverified', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await silenced(async () => {
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/out.ts': 'export const a = 1\n' },
        manifest: toManifest(['src/out.ts']),
        projectPath
      })

      // A pre-lock project (or fresh clone without the lock).
      Deno.removeSync(toGeneratedLockPath(manifestPath))

      const result = await statusHeadless({
        projectName: 'my-api',
        clientSettings: undefined,
        skmtcRootPath
      })

      assertEquals(result.counts.unverified, 1)
      // Unverified is indeterminate, not dirty — status stays clean.
      assertEquals(result.clean, true)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('statusHeadless - edited files spared from pruning surface as orphaned', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await silenced(async () => {
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/old.ts': 'export const old = 1\n' },
        manifest: toManifest(['src/old.ts']),
        projectPath
      })

      Deno.writeTextFileSync(join(tempDir, 'src/old.ts'), 'export const old = 1 // keep\n')

      // Next generate no longer produces old.ts — the prune spares it.
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/new.ts': 'export const fresh = 1\n' },
        manifest: toManifest(['src/new.ts']),
        projectPath
      })

      const result = await statusHeadless({
        projectName: 'my-api',
        clientSettings: undefined,
        skmtcRootPath
      })

      assertEquals(result.orphaned, ['src/old.ts'])
      assertEquals(result.counts, { clean: 1, modified: 0, missing: 0, unverified: 0, ejected: 0 })
      assertEquals(result.clean, false)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('statusHeadless - formatter-config drift reads as clean, not modified', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await silenced(async () => {
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/out.ts': `export const a = 'x'\n` },
        manifest: toManifest(['src/out.ts']),
        clientSettings: { formatter: 'deno fmt' },
        projectPath
      })
      assertEquals(Deno.readTextFileSync(join(tempDir, 'src/out.ts')), `export const a = "x";\n`)

      // The user switches formatter config and reformats the repo.
      Deno.writeTextFileSync(join(tempDir, 'src/out.ts'), `export const a = 'x';\n`)

      const result = await statusHeadless({
        projectName: 'my-api',
        clientSettings: { formatter: 'deno fmt --options-single-quote' },
        skmtcRootPath
      })

      assertEquals(result.counts, { clean: 1, modified: 0, missing: 0, unverified: 0, ejected: 0 })
      assertEquals(result.clean, true)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('statusHeadless - ejected files get their own status, not modified', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await silenced(async () => {
      const clientSettings = { ejected: ['@/src/owned.ts'] }

      writeGeneratedFiles({
        manifestPath,
        artifacts: {
          'src/owned.ts': 'export const owned = 1\n',
          'src/normal.ts': 'export const normal = 1\n'
        },
        manifest: toManifest(['src/owned.ts', 'src/normal.ts']),
        clientSettings,
        projectPath
      })

      // The user's edits to the ejected file are expected — not dirty.
      Deno.writeTextFileSync(join(tempDir, 'src/owned.ts'), 'export const owned = 42\n')

      const result = await statusHeadless({
        projectName: 'my-api',
        clientSettings,
        skmtcRootPath
      })

      assertEquals(result.files.find(({ path }) => path === 'src/owned.ts')?.status, 'ejected')
      assertEquals(result.counts.ejected, 1)
      assertEquals(result.counts.modified, 0)
      assertEquals(result.clean, true)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('statusHeadless - ejected files carry drift state from the last generate', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await silenced(async () => {
      const clientSettings = { ejected: ['@/src/owned.ts'] }

      // A generate run with a drifted ejected file: seed the committed
      // baseline + metadata the writer's drift pass reads.
      Deno.mkdirSync(join(projectPath, '.settings', 'baselines', 'src'), { recursive: true })
      Deno.writeTextFileSync(
        join(projectPath, '.settings', 'baselines', 'src', 'owned.ts'),
        'export const owned = 1\n'
      )
      Deno.writeTextFileSync(
        join(projectPath, '.settings', 'ejections.json'),
        JSON.stringify({
          version: 1,
          files: {
            '@/src/owned.ts': {
              reason: 'explicit',
              ejectedAt: '2026-07-10T00:00:00.000Z',
              generatedExportPath: '@/src/owned.generated.ts',
              items: [],
              baselineHash: toContentHash('export const owned = 1\n')
            }
          }
        })
      )
      Deno.mkdirSync(join(tempDir, 'src'), { recursive: true })
      Deno.writeTextFileSync(join(tempDir, 'src/owned.ts'), 'export const owned = 42 // mine\n')

      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/owned.ts': 'export const owned = 2\n' },
        manifest: toManifest(['src/owned.ts']),
        clientSettings,
        projectPath
      })

      const result = await statusHeadless({
        projectName: 'my-api',
        clientSettings,
        skmtcRootPath
      })

      const owned = result.files.find(({ path }) => path === 'src/owned.ts')
      assertEquals(owned?.status, 'ejected')
      assertEquals(owned?.ejection?.state, 'drifted')
      assertEquals(owned?.ejection?.classification, 'collision')
      assertEquals(result.staleEjections, [])
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('statusHeadless - stale ejections stay out of orphaned and keep --check clean', async () => {
  const { tempDir, skmtcRootPath, projectPath, manifestPath } = await toWorkspace('my-api')
  const originalCwd = Deno.cwd()
  try {
    Deno.chdir(tempDir)
    await silenced(async () => {
      const clientSettings = { ejected: ['@/src/owned.ts'] }

      // Seed: a generate tracking the ejected file, then a stale run
      // (nothing produces it anymore). The writer deliberately carries
      // the ejected lock entry forward — the exact combination that
      // previously leaked the file into `orphaned` and flipped --check.
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/owned.ts': 'export const owned = 1\n' },
        manifest: toManifest(['src/owned.ts']),
        clientSettings,
        projectPath
      })
      writeGeneratedFiles({
        manifestPath,
        artifacts: { 'src/other.generated.ts': 'export const other = 1\n' },
        manifest: toManifest(['src/other.generated.ts']),
        clientSettings,
        projectPath
      })

      const result = await statusHeadless({
        projectName: 'my-api',
        clientSettings,
        skmtcRootPath
      })

      assertEquals(result.staleEjections, ['src/owned.ts'])
      assertEquals(result.orphaned, [])
      // Stale ejections are informational — the --check gate stays green.
      assertEquals(result.clean, true)
    })
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})
