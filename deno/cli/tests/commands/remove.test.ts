import { assertEquals } from '@std/assert/equals'
import { toRemoveCommand } from '../../generators/remove.ts'
import { createMockManager } from '../mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '../mocks/skmtc-root.mock.ts'
import { createMockProject } from '../mocks/project.mock.ts'

Deno.test('remove command - removes generator', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
  })

  let removedGenerator: string | null = null
  mockProject.removeGenerator = async ({ moduleName }) => {
    removedGenerator = moduleName
  }

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toRemoveCommand(skmtcRoot)
  await command.parse(['test-project', '@skmtc/gen-typescript'])

  assertEquals(removedGenerator, '@skmtc/gen-typescript')
})

Deno.test('remove command - handles project not found gracefully', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toRemoveCommand(skmtcRoot)

  // Should not throw when project not found (uses optional chaining)
  let didNotThrow = false
  try {
    await command.parse(['non-existent', '@skmtc/gen-typescript'])
    didNotThrow = true
  } catch (error) {
    // Should not reach here
  }

  assertEquals(didNotThrow, true)
})