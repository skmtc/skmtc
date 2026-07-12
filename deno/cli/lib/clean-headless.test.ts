import { assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import type { ClientSettings } from '@skmtc/core/Settings'
import { cleanHeadless } from '@/lib/clean-headless.ts'

// Build a temp workspace: <appRoot>/.skmtc/<project>/.settings/manifest.json
// plus the generated files the manifest records. Returns { appRoot,
// skmtcRootPath } — skmtcRootPath is injected into cleanHeadless so the
// test never touches Deno.cwd().
const setup = async (
  project: string,
  manifestFiles: Record<string, string>, // path -> content
  extraFiles: Record<string, string> = {} // non-generated siblings
) => {
  const appRoot = await Deno.makeTempDir()
  const skmtcRootPath = join(appRoot, '.skmtc')
  const settingsDir = join(skmtcRootPath, project, '.settings')
  await Deno.mkdir(settingsDir, { recursive: true })

  for (const [rel, content] of Object.entries({ ...manifestFiles, ...extraFiles })) {
    const abs = join(appRoot, rel)
    await Deno.mkdir(join(abs, '..'), { recursive: true })
    await Deno.writeTextFile(abs, content)
  }

  const files: Record<string, { lines: number; characters: number; destinationPath: string }> = {}
  for (const rel of Object.keys(manifestFiles)) {
    files[rel] = { lines: 1, characters: 1, destinationPath: rel }
  }
  const manifest = {
    deploymentId: 'd',
    traceId: 't',
    spanId: 's',
    region: 'r',
    files,
    previews: {},
    mappings: {},
    parseIssues: [],
    results: {},
    startAt: 0,
    endAt: 0
  }
  await Deno.writeTextFile(join(settingsDir, 'manifest.json'), JSON.stringify(manifest))

  return { appRoot, skmtcRootPath, manifestPath: join(settingsDir, 'manifest.json') }
}

const SETTINGS: ClientSettings = { basePath: 'src' }

Deno.test('cleanHeadless - deletes recorded files, prunes emptied dirs, removes manifest', async () => {
  const { appRoot, skmtcRootPath, manifestPath } = await setup(
    'demo',
    {
      'src/generated/types/User.ts': 'x',
      'src/generated/api.ts': 'x'
    },
    {
      'src/generated/keep.ts': 'hand-written'
    }
  )
  try {
    const result = await cleanHeadless({
      projectName: 'demo',
      dryRun: false,
      clientSettings: SETTINGS,
      skmtcRootPath
    })

    assertEquals(result.deleted.sort(), ['src/generated/api.ts', 'src/generated/types/User.ts'])
    assertEquals(result.missing, [])
    assertEquals(result.skipped, [])
    assertEquals(result.removedDirs, ['src/generated/types'])
    assertEquals(result.manifestRemoved, true)
    assertEquals(result.noManifest, false)

    // Files gone, empty dir pruned, non-empty dir + sibling kept.
    assertEquals(existsSync(join(appRoot, 'src/generated/types')), false)
    assertEquals(existsSync(join(appRoot, 'src/generated/keep.ts')), true)
    assertEquals(existsSync(join(appRoot, 'src')), true)
    assertEquals(existsSync(manifestPath), false)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('cleanHeadless - dry run touches nothing', async () => {
  const { appRoot, skmtcRootPath, manifestPath } = await setup('demo', {
    'src/gen/User.ts': 'x'
  })
  try {
    const result = await cleanHeadless({
      projectName: 'demo',
      dryRun: true,
      clientSettings: SETTINGS,
      skmtcRootPath
    })

    assertEquals(result.dryRun, true)
    assertEquals(result.deleted, ['src/gen/User.ts'])
    assertEquals(result.removedDirs, ['src/gen'])
    assertEquals(result.manifestRemoved, false)

    // Nothing actually removed.
    assertEquals(existsSync(join(appRoot, 'src/gen/User.ts')), true)
    assertEquals(existsSync(join(appRoot, 'src/gen')), true)
    assertEquals(existsSync(manifestPath), true)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('cleanHeadless - no manifest is a no-op', async () => {
  const appRoot = await Deno.makeTempDir()
  const skmtcRootPath = join(appRoot, '.skmtc')
  await Deno.mkdir(join(skmtcRootPath, 'demo', '.settings'), { recursive: true })
  try {
    const result = await cleanHeadless({
      projectName: 'demo',
      dryRun: false,
      clientSettings: SETTINGS,
      skmtcRootPath
    })
    assertEquals(result.noManifest, true)
    assertEquals(result.deleted, [])
    assertEquals(result.removedDirs, [])
    assertEquals(result.manifestRemoved, false)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('cleanHeadless - reports already-absent files under missing', async () => {
  const { appRoot, skmtcRootPath } = await setup('demo', {
    'src/gen/Present.ts': 'x',
    'src/gen/Gone.ts': 'x'
  })
  // Remove one of the recorded files before cleaning.
  Deno.removeSync(join(appRoot, 'src/gen/Gone.ts'))
  try {
    const result = await cleanHeadless({
      projectName: 'demo',
      dryRun: false,
      clientSettings: SETTINGS,
      skmtcRootPath
    })
    assertEquals(result.deleted, ['src/gen/Present.ts'])
    assertEquals(result.missing, ['src/gen/Gone.ts'])
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('cleanHeadless - refuses to delete files resolving outside the app root', async () => {
  const { appRoot, skmtcRootPath } = await setup('demo', {
    'src/gen/Safe.ts': 'x'
  })
  // Hand-inject an escaping path into the manifest.
  const manifestPath = join(skmtcRootPath, 'demo', '.settings', 'manifest.json')
  const raw = JSON.parse(await Deno.readTextFile(manifestPath))
  raw.files['../../../etc/evil.ts'] = {
    lines: 1,
    characters: 1,
    destinationPath: '../../../etc/evil.ts'
  }
  await Deno.writeTextFile(manifestPath, JSON.stringify(raw))
  try {
    const result = await cleanHeadless({
      projectName: 'demo',
      dryRun: false,
      clientSettings: SETTINGS,
      skmtcRootPath
    })
    assertEquals(result.deleted, ['src/gen/Safe.ts'])
    assertEquals(result.skipped, ['../../../etc/evil.ts'])
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('cleanHeadless - skips dir pruning when basePath is absent', async () => {
  const { appRoot, skmtcRootPath } = await setup('demo', {
    'src/gen/User.ts': 'x'
  })
  try {
    const result = await cleanHeadless({
      projectName: 'demo',
      dryRun: false,
      clientSettings: undefined,
      skmtcRootPath
    })
    // File still deleted, but no dir pruning without an anchor.
    assertEquals(result.deleted, ['src/gen/User.ts'])
    assertEquals(result.removedDirs, [])
    assertEquals(existsSync(join(appRoot, 'src/gen')), true)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

// --- ejected + modified handling (override/eject arc) -----------------------

Deno.test('cleanHeadless - spares ejected files and reports modified ones', async () => {
  const { writeGeneratedFiles } = await import('@/lib/write-generated-files.ts')
  const { cleanHeadless } = await import('@/lib/clean-headless.ts')
  const { join } = await import('@std/path/join')
  const { existsSync } = await import('@std/fs/exists')
  const v = await import('valibot')
  const { manifestContent } = await import('@skmtc/core/Manifest')

  const tempDir = await Deno.makeTempDir()
  const originalCwd = Deno.cwd()
  const originalError = console.error
  console.error = () => {}
  try {
    Deno.chdir(tempDir)
    const skmtcRootPath = join(tempDir, '.skmtc')
    const projectPath = join(skmtcRootPath, 'my-api')
    const manifestPath = join(projectPath, '.settings', 'manifest.json')
    const clientSettings = { ejected: ['@/src/owned.ts'] }

    writeGeneratedFiles({
      manifestPath,
      artifacts: {
        'src/owned.ts': 'export const owned = 1\n',
        'src/edited.generated.ts': 'export const edited = 1\n',
        'src/plain.generated.ts': 'export const plain = 1\n'
      },
      manifest: v.parse(manifestContent, {
        deploymentId: 't',
        traceId: 't',
        spanId: 't',
        files: {
          'src/owned.ts': { lines: 1, characters: 1, destinationPath: '@/src/owned.ts' },
          'src/edited.generated.ts': {
            lines: 1,
            characters: 1,
            destinationPath: '@/src/edited.generated.ts'
          },
          'src/plain.generated.ts': {
            lines: 1,
            characters: 1,
            destinationPath: '@/src/plain.generated.ts'
          }
        },
        previews: {},
        parseIssues: [],
        results: {},
        startAt: Date.now(),
        endAt: Date.now()
      }),
      clientSettings,
      projectPath
    })

    Deno.writeTextFileSync(
      join(tempDir, 'src/edited.generated.ts'),
      'export const edited = 1 // mine\n'
    )

    // The writer never writes ejected files — on disk it exists because
    // the eject flow renamed it there. Simulate that.
    Deno.writeTextFileSync(join(tempDir, 'src/owned.ts'), 'export const owned = 1 // mine\n')

    const result = await cleanHeadless({
      projectName: 'my-api',
      dryRun: false,
      clientSettings,
      skmtcRootPath
    })

    // The ejected file is spared; the modified file is deleted but
    // reported; the plain file is deleted quietly.
    assertEquals(result.ejected, ['src/owned.ts'])
    assertEquals(result.modified, ['src/edited.generated.ts'])
    assertEquals(existsSync(join(tempDir, 'src/owned.ts')), true)
    assertEquals(existsSync(join(tempDir, 'src/edited.generated.ts')), false)
    assertEquals(existsSync(join(tempDir, 'src/plain.generated.ts')), false)
    assertEquals(result.deleted.sort(), ['src/edited.generated.ts', 'src/plain.generated.ts'])
  } finally {
    console.error = originalError
    Deno.chdir(originalCwd)
    await Deno.remove(tempDir, { recursive: true })
  }
})
