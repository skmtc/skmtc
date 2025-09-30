import { assertEquals } from '@std/assert/equals'
import { toInstallCommand } from '../../generators/install.ts'
import { createMockManager } from '../mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '../mocks/skmtc-root.mock.ts'
import { createMockProject } from '../mocks/project.mock.ts'

Deno.test('install command - installs generator', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: []
  })

  let installedGenerator: string | null = null
  mockProject.installGenerator = async ({ moduleName }) => {
    installedGenerator = moduleName
    return undefined
  }

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toInstallCommand(skmtcRoot)
  await command.parse(['test-project', 'jsr:@skmtc/gen-typescript@^0.0.1'])

  assertEquals(installedGenerator, 'jsr:@skmtc/gen-typescript@^0.0.1')
})

Deno.test('install command - handles installation', async () => {
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

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toInstallCommand(skmtcRoot)
  await command.parse(['test-project', 'jsr:@skmtc/gen-zod'])

  assertEquals(installedGenerators.length, 1)
  assertEquals(installedGenerators[0], 'jsr:@skmtc/gen-zod')
})