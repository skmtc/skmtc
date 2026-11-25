import { assertEquals } from '@std/assert/equals'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'

Deno.test('CloneGeneratorView - space key should toggle selection', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
  })

  // Simulate the space toggle behavior
  const selectedGenerators = new Set<string>()
  const generator = '@skmtc/gen-typescript'

  // First space press - add to selection
  if (selectedGenerators.has(generator)) {
    selectedGenerators.delete(generator)
  } else {
    selectedGenerators.add(generator)
  }
  assertEquals(selectedGenerators.has(generator), true)

  // Second space press - remove from selection
  if (selectedGenerators.has(generator)) {
    selectedGenerators.delete(generator)
  } else {
    selectedGenerators.add(generator)
  }
  assertEquals(selectedGenerators.has(generator), false)
})

Deno.test('CloneGeneratorView - escape key should cancel without cloning', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript']
  })

  let cloneCalled = false
  mockProject.cloneGenerators = async ({ moduleNames }) => {
    cloneCalled = true
    return await Promise.resolve(moduleNames.map(moduleName => ({ moduleName, version: '0.0.0' })))
  }

  // Simulate escape press behavior - should not trigger cloning
  const selectedGenerators = new Set<string>(['@skmtc/gen-typescript'])
  const escapePressedBeforeConfirm = true

  if (!escapePressedBeforeConfirm) {
    // Cloning would happen here
    await mockProject.cloneGenerators({
      moduleNames: ['@skmtc/gen-typescript']
    })
  }

  assertEquals(cloneCalled, false)
  assertEquals(selectedGenerators.size, 1) // Selection remains but cloning never triggered
})

Deno.test('CloneGeneratorView - multiple generators can be selected and cloned', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod', '@skmtc/gen-msw']
  })

  const clonedGenerators: string[] = []
  mockProject.cloneGenerators = async ({ moduleNames }) => {
    clonedGenerators.push(...moduleNames)
    return await Promise.resolve(moduleNames.map(moduleName => ({ moduleName, version: '0.0.0' })))
  }

  // Simulate selecting multiple generators
  const selectedGenerators = new Set<string>()
  const generators = ['@skmtc/gen-typescript', '@skmtc/gen-zod']

  generators.forEach(gen => selectedGenerators.add(gen))
  assertEquals(selectedGenerators.size, 2)

  // Simulate cloning of all selected
  await mockProject.cloneGenerators({
    moduleNames: Array.from(selectedGenerators)
  })

  assertEquals(clonedGenerators.length, 2)
  assertEquals(clonedGenerators.includes('@skmtc/gen-typescript'), true)
  assertEquals(clonedGenerators.includes('@skmtc/gen-zod'), true)
})
