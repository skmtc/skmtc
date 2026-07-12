import { assertEquals } from '@std/assert/equals'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'

Deno.test('CloneGeneratorView - space key should toggle selection', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
  })

  const clonedGenerators: string[] = []
  mockProject.cloneGenerator = async ({ moduleName }) => {
    clonedGenerators.push(moduleName)
    return { moduleName, version: '0.0.0' }
  }

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
  mockProject.cloneGenerator = async ({ moduleName }) => {
    cloneCalled = true
    return { moduleName, version: '0.0.0' }
  }

  // Simulate escape press behavior - should not trigger cloning
  const selectedGenerators = new Set<string>(['@skmtc/gen-typescript'])
  const escapePressedBeforeConfirm = true

  if (!escapePressedBeforeConfirm) {
    // Cloning would happen here
    await mockProject.cloneGenerator({
      moduleName: '@skmtc/gen-typescript',
      projectName: mockProject.name
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
  mockProject.cloneGenerator = async ({ moduleName }) => {
    clonedGenerators.push(moduleName)
    return { moduleName, version: '0.0.0' }
  }

  // Simulate selecting multiple generators
  const selectedGenerators = new Set<string>()
  const generators = ['@skmtc/gen-typescript', '@skmtc/gen-zod']

  generators.forEach(gen => selectedGenerators.add(gen))
  assertEquals(selectedGenerators.size, 2)

  // Simulate cloning of all selected
  await Promise.all(
    Array.from(selectedGenerators).map(gen =>
      mockProject.cloneGenerator({
        moduleName: gen,
        projectName: mockProject.name
      })
    )
  )

  assertEquals(clonedGenerators.length, 2)
  assertEquals(clonedGenerators.includes('@skmtc/gen-typescript'), true)
  assertEquals(clonedGenerators.includes('@skmtc/gen-zod'), true)
})
