import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { assertStringIncludes } from '@std/assert/string-includes'
import { existsSync } from '@std/fs/exists'
import { walk } from '@std/fs/walk'
import { fromFileUrl } from '@std/path/from-file-url'
import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { relative } from '@std/path/relative'
import { createBundle, createReadOnlyBundle } from '@/lib/create-bundle.ts'
import { openBundleProject } from '@/lib/bundle-project.ts'
import { Manager } from '@/lib/manager.ts'
import {
  twoCoreRegistry,
  withJsrRegistryServer,
  withRegistryProject
} from '@/tests/mocks/jsr-registry-server.mock.ts'

const build = async (projectName: string): Promise<string> =>
  await createBundle({ project: await openBundleProject(projectName, new Manager()) })

/** Every file in the project, by relative path, with its contents. */
const snapshot = async (projectPath: string): Promise<Record<string, string>> => {
  const entries: [string, string][] = []
  for await (const entry of walk(projectPath, { includeDirs: false })) {
    entries.push([relative(projectPath, entry.path), await Deno.readTextFile(entry.path)])
  }
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)))
}

const setImport = async (projectPath: string, name: string, specifier: string) => {
  const denoJsonPath = join(projectPath, 'deno.json')
  const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath))
  denoJson.imports[name] = specifier
  await Deno.writeTextFile(denoJsonPath, JSON.stringify(denoJson))
}

Deno.test('createBundle - a refused build leaves the earlier bundle.js and no temporary file', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.2.0' },
      async ({ projectName, projectPath }) => {
        await assertRejects(() => build(projectName), Error, 'more than one copy of @skmtc/core')

        assertEquals(
          await Deno.readTextFile(join(projectPath, 'bundle.js')),
          'export default undefined\n'
        )
        const settingsFiles = Array.from(Deno.readDirSync(join(projectPath, '.settings')))
        assertEquals(
          settingsFiles.filter(entry => entry.name.startsWith('bundle-')),
          []
        )
      }
    )
  })
})

Deno.test('createBundle - refuses a module graph it can not read', async () => {
  // A generator whose source is missing: `deno info` reports the module
  // error, so the graph can't show one copy of @skmtc/core.
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0', imports: { '@skmtc/gen-x': './gen-x/mod.ts' } },
      async ({ projectName }) => {
        await assertRejects(
          () => build(projectName),
          Error,
          'Could not check that project "api" resolves one copy of @skmtc/core'
        )
      }
    )
  })
})

Deno.test('createBundle - each build replaces the logs of the one before', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await build(projectName)
        await build(projectName)

        const errorLogs = await Deno.readTextFile(join(projectPath, '.settings', 'error-logs.txt'))
        assertEquals(errorLogs.split('Bundled').length - 1, 1)
      }
    )
  })
})

Deno.test('createReadOnlyBundle - builds the current project and writes nothing to it', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0', imports: { '@skmtc/gen-c': './gen-c/mod.ts' } },
      async ({ projectName, projectPath }) => {
        await Deno.mkdir(join(projectPath, 'gen-c'))
        await Deno.writeTextFile(
          join(projectPath, 'gen-c', 'mod.ts'),
          "export default { id: '@skmtc/gen-c', label: 'before-edit' }\n"
        )
        await build(projectName)
        await Deno.writeTextFile(
          join(projectPath, 'gen-c', 'mod.ts'),
          "export default { id: '@skmtc/gen-c', label: 'after-edit' }\n"
        )
        const before = await snapshot(projectPath)

        const bundle = await createReadOnlyBundle({ projectName, projectPath })
        const bundleFsPath = fromFileUrl(bundle.bundlePath)
        const contents = await Deno.readTextFile(bundleFsPath)
        await bundle[Symbol.asyncDispose]()

        assertStringIncludes(contents, 'after-edit')
        assertStringIncludes(contents, '@skmtc/gen-a/0.1.0/')
        assertEquals(await snapshot(projectPath), before)
        assertEquals(existsSync(dirname(bundleFsPath)), false)
      }
    )
  })
})

Deno.test('createReadOnlyBundle - refuses pins the lockfile has not seen, and leaves the lock', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await build(projectName)
        await setImport(projectPath, '@skmtc/gen-b', 'jsr:@skmtc/gen-b@0.1.0')
        const before = await snapshot(projectPath)

        await assertRejects(
          () => createReadOnlyBundle({ projectName, projectPath }),
          Error,
          'deno.lock'
        )

        assertEquals(await snapshot(projectPath), before)
      }
    )
  })
})

Deno.test('createReadOnlyBundle - refuses two copies of @skmtc/core', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await build(projectName)
        // Lock the two-core graph without building it, so only the graph
        // check stands between the read-only build and two cores.
        await setImport(projectPath, '@skmtc/gen-a', 'jsr:@skmtc/gen-a@0.2.0')
        await new Deno.Command('deno', { args: ['cache', 'worker.ts'], cwd: projectPath }).output()

        await assertRejects(
          () => createReadOnlyBundle({ projectName, projectPath }),
          Error,
          '@skmtc/core 0.2.0 ← @skmtc/gen-a@0.2.0'
        )
      }
    )
  })
})

Deno.test('createReadOnlyBundle - a project without the worker pins points at generate', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        const denoJsonPath = join(projectPath, 'deno.json')
        const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath))
        delete denoJson.imports['@skmtc/worker']
        await Deno.writeTextFile(denoJsonPath, JSON.stringify(denoJson))

        await assertRejects(
          () => createReadOnlyBundle({ projectName, projectPath }),
          Error,
          `Run \`skmtc generate ${projectName}\``
        )
      }
    )
  })
})
