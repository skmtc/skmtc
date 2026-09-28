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

        const denoJsonPath = join(projectPath, 'deno.json')
        const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath))
        denoJson.imports['@skmtc/gen-b'] = 'jsr:@skmtc/gen-b@0.1.0'
        await Deno.writeTextFile(denoJsonPath, JSON.stringify(denoJson))

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

Deno.test('bundleHeadless - a worker and generator released a patch apart share one @skmtc/core', async () => {
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
        assertEquals(checkBundleCopies(join(projectPath, 'bundle.js')), {
          type: 'single-copies',
          packages: [{ name: '@skmtc/core', copies: [{ version: '0.1.1', importedBy: [] }] }]
        })
      }
    )
  })
})

Deno.test('bundleHeadless - a deno.lock from before the patch still yields one @skmtc/core', async () => {
  // The lock records core 0.1.0 for the worker's `^0.1.0`. Installing a
  // generator released on core 0.1.1 must move that entry, not add a copy.
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
        assertEquals(checkBundleCopies(join(projectPath, 'bundle.js')), {
          type: 'single-copies',
          packages: [{ name: '@skmtc/core', copies: [{ version: '0.1.0', importedBy: [] }] }]
        })

        registry['@skmtc/core']['0.1.1'] = core
        registry['@skmtc/gen-a']['0.2.0'] = generator
        const denoJsonPath = join(projectPath, 'deno.json')
        const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath))
        denoJson.imports['@skmtc/gen-a'] = 'jsr:@skmtc/gen-a@0.2.0'
        await Deno.writeTextFile(denoJsonPath, JSON.stringify(denoJson))

        const result = await bundleHeadless({
          skmtcRoot: await SkmtcRoot.open(new Manager()),
          projectName
        })

        assertEquals(result.type, 'bundled')
        assertEquals(checkBundleCopies(join(projectPath, 'bundle.js')), {
          type: 'single-copies',
          packages: [{ name: '@skmtc/core', copies: [{ version: '0.1.1', importedBy: [] }] }]
        })
      }
    )
  })
})
