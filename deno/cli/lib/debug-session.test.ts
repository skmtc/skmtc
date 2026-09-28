import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import { toDebugGraphRefusal } from '@/lib/debug-session.ts'
import {
  twoCoreRegistry,
  withJsrRegistryServer,
  withRegistryProject
} from '@/tests/mocks/jsr-registry-server.mock.ts'

Deno.test('toDebugGraphRefusal - checks the pins when the project has no worker.ts', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        await Deno.remove(join(projectPath, 'worker.ts'))

        assertEquals(await toDebugGraphRefusal({ projectName, projectPath }), undefined)
      }
    )
  })
})

Deno.test('toDebugGraphRefusal - refuses two cores and names its entry worker.ts', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.2.0' },
      async ({ projectName, projectPath }) => {
        await Deno.remove(join(projectPath, 'worker.ts'))

        const refusal = await toDebugGraphRefusal({ projectName, projectPath })

        assertStringIncludes(refusal ?? '', 'more than one copy of @skmtc/core')
        assertStringIncludes(refusal ?? '', '@skmtc/core 0.1.0 ← worker.ts\n')
        assertStringIncludes(refusal ?? '', '@skmtc/core 0.2.0 ← @skmtc/gen-a@0.2.0\n')
      }
    )
  })
})
