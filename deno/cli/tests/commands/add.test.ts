import { assertEquals } from '@std/assert/equals'
import { toAddCommand } from '@/generators/add.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'

Deno.test('add command - adds operation generator', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'test-project' })

  let addedGenerator: { moduleName: string; type: string } | null = null
  mockProject.addGenerator = async (args) => {
    addedGenerator = args
  }

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toAddCommand(skmtcRoot)
  await command.parse(['test-project', 'my-operation-gen', 'operation'])

  assertEquals(addedGenerator, {
    moduleName: 'my-operation-gen',
    type: 'operation'
  })
})

Deno.test('add command - adds model generator', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'test-project' })

  let addedGenerator: { moduleName: string; type: string } | null = null
  mockProject.addGenerator = async (args) => {
    addedGenerator = args
  }

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toAddCommand(skmtcRoot)
  await command.parse(['test-project', 'my-model-gen', 'model'])

  assertEquals(addedGenerator, {
    moduleName: 'my-model-gen',
    type: 'model'
  })
})

Deno.test('add command - handles project not found gracefully', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toAddCommand(skmtcRoot)

  // Should not throw when project not found (uses optional chaining)
  let didNotThrow = false
  try {
    await command.parse(['non-existent', 'generator-name', 'operation'])
    didNotThrow = true
  } catch (error) {
    // Should not reach here
  }

  assertEquals(didNotThrow, true)
})