import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { assertStringIncludes } from '@std/assert/string-includes'
import { existsSync } from '@std/fs/exists'
import { join } from '@std/path/join'
import { bundleHeadless } from '@/lib/bundle-headless.ts'
import { Manager } from '@/lib/manager.ts'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import {
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
