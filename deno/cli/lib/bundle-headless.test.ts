import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { assertStringIncludes } from '@std/assert/string-includes'
import { existsSync } from '@std/fs/exists'
import { join } from '@std/path/join'
import { bundleHeadless } from '@/lib/bundle-headless.ts'
import { checkBundleFreshness } from '@/lib/bundle-freshness.ts'
import { checkBundleCopies } from '@/lib/duplicate-packages.ts'
import { Manager } from '@/lib/manager.ts'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import {
  toPatchApartRegistry,
  twoCoreRegistry,
  withJsrRegistryServer,
  withRegistryProject
} from '@/tests/mocks/jsr-registry-server.mock.ts'

/** Adds (or repins) imports in the project's `deno.json`, as `install` does. */
const addProjectImports = async (projectPath: string, imports: Record<string, string>) => {
  const denoJsonPath = join(projectPath, 'deno.json')
  const denoJson: { imports: Record<string, string> } = JSON.parse(
    await Deno.readTextFile(denoJsonPath)
  )
  denoJson.imports = { ...denoJson.imports, ...imports }
  await Deno.writeTextFile(denoJsonPath, JSON.stringify(denoJson))
}

/** The bundle holds exactly one `@skmtc/core`, at `version`. */
const assertOneCore = (projectPath: string, version: string) =>
  assertEquals(checkBundleCopies(join(projectPath, 'bundle.js')), {
    type: 'single-copies',
    packages: [{ name: '@skmtc/core', copies: [{ version, importedBy: [] }] }]
  })

Deno.test('bundleHeadless - refuses a graph with two copies of @skmtc/core', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.2.0' },
      async ({ projectName, projectPath }) => {
        await Deno.remove(join(projectPath, 'bundle.js'))
        const skmtcRoot = await SkmtcRoot.open(new Manager())

        const error = await assertRejects(() => bundleHeadless({ skmtcRoot, projectName }), Error)

        assertStringIncludes(error.message, 'resolves more than one copy of @skmtc/core')
        assertStringIncludes(error.message, '@skmtc/core 0.1.0 ← @skmtc/worker@0.1.0')
        assertStringIncludes(error.message, '@skmtc/core 0.2.0 ← @skmtc/gen-a@0.2.0')
        assertEquals(existsSync(join(projectPath, 'bundle.js')), false)
      }
    )
  })
})

Deno.test('bundleHeadless - bundles a graph with one @skmtc/core', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await Deno.remove(join(projectPath, 'bundle.js'))
        const skmtcRoot = await SkmtcRoot.open(new Manager())

        const result = await bundleHeadless({ skmtcRoot, projectName })

        assertEquals(result.type, 'bundled')
        assertEquals(existsSync(join(projectPath, 'bundle.js')), true)
      }
    )
  })
})

Deno.test('bundleHeadless - a refusal keeps the worker.ts the old bundle.js was built from', async () => {
  // `install` adds gen-b (on core 0.2.0) to a bundled project. The refused
  // bundle must not leave a worker.ts that makes the old bundle.js — which
  // lacks gen-b — look fresh.
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await bundleHeadless({ skmtcRoot: await SkmtcRoot.open(new Manager()), projectName })
        const workerPath = join(projectPath, 'worker.ts')
        const bundledWorker = await Deno.readTextFile(workerPath)

        await addProjectImports(projectPath, { '@skmtc/gen-b': 'jsr:@skmtc/gen-b@0.1.0' })

        await assertRejects(
          async () =>
            bundleHeadless({ skmtcRoot: await SkmtcRoot.open(new Manager()), projectName }),
          Error,
          '@skmtc/core 0.2.0 ← @skmtc/gen-b@0.1.0'
        )

        assertEquals(await Deno.readTextFile(workerPath), bundledWorker)
        const freshness = checkBundleFreshness({ projectName })
        assertEquals(freshness.type, 'stale')
        assertEquals(freshness.type === 'stale' ? freshness.added : [], ['@skmtc/gen-b'])
      }
    )
  })
})

Deno.test('bundleHeadless - the project core pin decides which core the ranged packages share', async () => {
  // The worker and gen-a both accept 0.1.1, but the project pins 0.1.0.
  await withJsrRegistryServer(toPatchApartRegistry(), async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await bundleHeadless({ skmtcRoot: await SkmtcRoot.open(new Manager()), projectName })

        assertOneCore(projectPath, '0.1.0')
      }
    )
  })
})

Deno.test('bundleHeadless - a ranged worker beside an exact-pinned generator shares one core', async () => {
  // gen-exact pins core 0.1.0; the worker's `^0.1.0` would float to 0.1.1
  // if the project pin were not in the graph.
  await withJsrRegistryServer(toPatchApartRegistry(), async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0', imports: { '@skmtc/gen-exact': 'jsr:@skmtc/gen-exact@0.1.0' } },
      async ({ projectName, projectPath }) => {
        await bundleHeadless({ skmtcRoot: await SkmtcRoot.open(new Manager()), projectName })

        assertOneCore(projectPath, '0.1.0')
      }
    )
  })
})

Deno.test('bundleHeadless - a worker and generator released a patch apart share one @skmtc/core', async () => {
  // The worker was released on core 0.1.0 and gen-a@0.2.0 on 0.1.1; the
  // project pins 0.1.1, the lower bound of a CLI released alongside gen-a.
  await withJsrRegistryServer(toPatchApartRegistry(), async () => {
    await withRegistryProject(
      { generatorVersion: '0.2.0', imports: { '@skmtc/core': 'jsr:@skmtc/core@0.1.1' } },
      async ({ projectName, projectPath }) => {
        await Deno.remove(join(projectPath, 'bundle.js'))
        assertEquals(existsSync(join(projectPath, 'deno.lock')), false)

        const result = await bundleHeadless({
          skmtcRoot: await SkmtcRoot.open(new Manager()),
          projectName
        })

        assertEquals(result.type, 'bundled')
        assertOneCore(projectPath, '0.1.1')
      }
    )
  })
})

Deno.test('bundleHeadless - a deno.lock from before the patch still yields one @skmtc/core', async () => {
  // The lock records core 0.1.0 for the project pin and the worker's
  // `^0.1.0`. Moving the pin to 0.1.1 and installing a generator released
  // on 0.1.1 must move those entries, not add a copy.
  const registry = toPatchApartRegistry()
  const { '0.1.1': core, ...earlierCores } = registry['@skmtc/core']
  const { '0.2.0': generator, ...earlierGenerators } = registry['@skmtc/gen-a']
  registry['@skmtc/core'] = earlierCores
  registry['@skmtc/gen-a'] = earlierGenerators

  await withJsrRegistryServer(registry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await bundleHeadless({ skmtcRoot: await SkmtcRoot.open(new Manager()), projectName })
        assertEquals(existsSync(join(projectPath, 'deno.lock')), true)
        assertOneCore(projectPath, '0.1.0')

        registry['@skmtc/core']['0.1.1'] = core
        registry['@skmtc/gen-a']['0.2.0'] = generator
        await addProjectImports(projectPath, {
          '@skmtc/core': 'jsr:@skmtc/core@0.1.1',
          '@skmtc/gen-a': 'jsr:@skmtc/gen-a@0.2.0'
        })

        const result = await bundleHeadless({
          skmtcRoot: await SkmtcRoot.open(new Manager()),
          projectName
        })

        assertEquals(result.type, 'bundled')
        assertOneCore(projectPath, '0.1.1')
      }
    )
  })
})

Deno.test('bundleHeadless - refuses a generator whose core range starts above the project pin', async () => {
  await withJsrRegistryServer(toPatchApartRegistry(), async () => {
    await withRegistryProject({ generatorVersion: '0.2.0' }, async ({ projectName }) => {
      await assertRejects(
        async () => bundleHeadless({ skmtcRoot: await SkmtcRoot.open(new Manager()), projectName }),
        Error,
        '@skmtc/core 0.1.1 ← @skmtc/gen-a@0.2.0'
      )
    })
  })
})
