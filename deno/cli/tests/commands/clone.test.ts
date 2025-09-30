import { assertEquals } from '@std/assert/equals'
import { toCloneCommand } from '@/generators/clone.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'

Deno.test('clone command - clones generator', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript']
  })

  let clonedGenerator: string | null = null
  mockProject.cloneGenerator = async ({ moduleName }) => {
    clonedGenerator = moduleName
  }

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toCloneCommand(skmtcRoot)
  await command.parse(['test-project', '@skmtc/gen-typescript'])

  assertEquals(clonedGenerator, '@skmtc/gen-typescript')
})

Deno.test('clone command - handles cloning operation', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'my-project',
    generators: ['@skmtc/gen-zod', '@skmtc/gen-msw']
  })

  const clonedGenerators: string[] = []
  mockProject.cloneGenerator = async ({ moduleName }) => {
    clonedGenerators.push(moduleName)
  }

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toCloneCommand(skmtcRoot)
  await command.parse(['my-project', '@skmtc/gen-zod'])

  assertEquals(clonedGenerators.length, 1)
  assertEquals(clonedGenerators[0], '@skmtc/gen-zod')
})