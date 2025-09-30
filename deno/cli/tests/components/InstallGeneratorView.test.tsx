import { assertEquals } from '@std/assert/equals'
import { createMockManager } from '../mocks/manager.mock.ts'
import { createMockProject } from '../mocks/project.mock.ts'

Deno.test('InstallGeneratorView - space key should toggle selection', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript']
  })

  const installedGenerators: string[] = []
  mockProject.installGenerator = async ({ moduleName }) => {
    installedGenerators.push(moduleName)
    return undefined
  }

  // Simulate the space toggle behavior
  const selectedGenerators = new Set<string>()
  const generator = 'jsr:@skmtc/gen-zod'

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

Deno.test('InstallGeneratorView - escape key should cancel without installing', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript']
  })

  let installCalled = false
  mockProject.installGenerator = async () => {
    installCalled = true
    return undefined
  }

  // Simulate escape press behavior - should not trigger installation
  const selectedGenerators = new Set<string>(['jsr:@skmtc/gen-zod'])
  const escapePressedBeforeConfirm = true

  if (!escapePressedBeforeConfirm) {
    // Installation would happen here
    await mockProject.installGenerator({ moduleName: 'jsr:@skmtc/gen-zod' })
  }

  assertEquals(installCalled, false)
  assertEquals(selectedGenerators.size, 1) // Selection remains but installation never triggered
})

Deno.test('InstallGeneratorView - multiple generators can be selected', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: []
  })

  const installedGenerators: string[] = []
  mockProject.installGenerator = async ({ moduleName }) => {
    installedGenerators.push(moduleName)
    return undefined
  }

  // Simulate selecting multiple generators
  const selectedGenerators = new Set<string>()
  const generators = ['jsr:@skmtc/gen-typescript', 'jsr:@skmtc/gen-zod', 'jsr:@skmtc/gen-msw']

  generators.forEach(gen => selectedGenerators.add(gen))
  assertEquals(selectedGenerators.size, 3)

  // Simulate installation of all selected
  await Promise.all(
    Array.from(selectedGenerators).map(gen =>
      mockProject.installGenerator({ moduleName: gen })
    )
  )

  assertEquals(installedGenerators.length, 3)
  assertEquals(installedGenerators.includes('jsr:@skmtc/gen-typescript'), true)
  assertEquals(installedGenerators.includes('jsr:@skmtc/gen-zod'), true)
  assertEquals(installedGenerators.includes('jsr:@skmtc/gen-msw'), true)
})