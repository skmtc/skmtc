import { assertEquals, assertStringIncludes, assertThrows } from '@std/assert'
import { stub } from '@std/testing/mock'
import { ensureDir } from '@std/fs/ensure-dir'
import { join } from '@std/path/join'
import { homedir } from 'node:os'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { ProjectLoadError } from '@/lib/project-load-error.ts'
import { initHeadless } from '@/lib/init-headless.ts'
import { deployHeadless } from '@/lib/deploy-headless.ts'
import { Manager } from '@/lib/manager.ts'
import { SKMTC_IGNORE_FILE } from '@/lib/source-upload.ts'
import { toPinnedImports, withStackHub } from '@/tests/mocks/stack-hub.mock.ts'

const CUSTOM_IGNORE = 'secrets/\n'

type Workspace = { root: string; skmtcRoot: SkmtcRoot; manager: Manager }

/**
 * A workspace with a stack project `good` and a project `broken` whose
 * schema is a build output that does not exist yet, as skmtc-hub's
 * skmtc-control in a fresh checkout (#374).
 */
const withWorkspace = async (fn: (workspace: Workspace) => Promise<void>) => {
  const root = await Deno.makeTempDir({ prefix: 'skmtc-unloaded-', dir: homedir() })
  const prevCwd = Deno.cwd()
  // The load warning goes to stderr; keep the test output clean.
  const errorStub = stub(console, 'error', () => {})

  try {
    const good = join(root, '.skmtc', 'good')
    const broken = join(root, '.skmtc', 'broken')
    await ensureDir(join(good, '.settings'))
    await ensureDir(join(broken, '.settings'))

    await Deno.writeTextFile(
      join(good, 'deno.json'),
      JSON.stringify({ name: '@acme/my-api', version: '3.0.1', imports: toPinnedImports() })
    )
    await Deno.writeTextFile(join(good, 'deno.lock'), '{}')

    await Deno.writeTextFile(join(broken, 'deno.json'), JSON.stringify({ imports: {} }))
    await Deno.writeTextFile(join(broken, SKMTC_IGNORE_FILE), CUSTOM_IGNORE)
    await Deno.writeTextFile(
      join(broken, '.settings', 'client.json'),
      JSON.stringify({
        settings: { basePath: './src' },
        source: 'packages/api/dist/openapi.missing.json'
      })
    )

    Deno.chdir(root)
    const manager = new Manager()
    const skmtcRoot = await SkmtcRoot.open(manager)

    await fn({ root, skmtcRoot, manager })
  } finally {
    errorStub.restore()
    Deno.chdir(prevCwd)
    await Deno.remove(root, { recursive: true })
  }
}

Deno.test('a broken project does not stop a deploy of the other project', async () => {
  await withWorkspace(async ({ skmtcRoot }) => {
    let result: Awaited<ReturnType<typeof deployHeadless>> | undefined
    await withStackHub({}, async () => {
      result = await deployHeadless({
        skmtcRoot,
        projectName: 'good',
        token: 'pat-123',
        origin: 'https://hub.test',
        refreshLock: () => Promise.resolve()
      })
    })

    assertEquals(result?.type, 'deployed')
  })
})

Deno.test(
  'lookupProject - a folder that did not load throws its load error, not "not found"',
  async () => {
    await withWorkspace(async ({ skmtcRoot }) => {
      const error = assertThrows(() => skmtcRoot.lookupProject('broken'), ProjectLoadError)
      assertStringIncludes(error.message, 'openapi.missing.json')
      assertEquals(skmtcRoot.lookupProject('absent'), undefined)
    })
  }
)

Deno.test(
  'initHeadless - a folder that did not load already exists, and its files stay',
  async () => {
    await withWorkspace(async ({ root, skmtcRoot, manager }) => {
      const result = await initHeadless({ skmtcRoot, projectName: 'broken', basePath: './other' })
      await manager.cleanup()

      assertEquals(result, { type: 'existed', projectName: 'broken' })
      // Creating over the folder replaced a custom .skmtcignore with the template.
      assertEquals(
        await Deno.readTextFile(join(root, '.skmtc', 'broken', SKMTC_IGNORE_FILE)),
        CUSTOM_IGNORE
      )
    })
  }
)
