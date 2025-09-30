import { assertEquals } from '@std/assert/equals'
import { toInitCommand } from '../../lib/init.ts'
import { createMockManager } from '../mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '../mocks/skmtc-root.mock.ts'

Deno.test('init command - creates new project', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const createdProject: {
    name: string | null
    basePath: string | null
    generators: string[] | null
  } = { name: null, basePath: null, generators: null }

  skmtcRoot.createProject = async ({ name, basePath, generators }) => {
    createdProject.name = name
    createdProject.basePath = basePath
    createdProject.generators = generators
    const mockProject = (await import('../mocks/project.mock.ts')).createMockProject(manager, {
      name,
      generators
    })
    skmtcRoot.projects.push(mockProject)
    return mockProject
  }

  const command = toInitCommand(skmtcRoot)
  await command.parse([
    'my-new-project',
    'jsr:@skmtc/gen-typescript,jsr:@skmtc/gen-zod',
    'src'
  ])

  assertEquals(createdProject.name, 'my-new-project')
  assertEquals(createdProject.basePath, 'src')
  assertEquals(createdProject.generators, ['jsr:@skmtc/gen-typescript', 'jsr:@skmtc/gen-zod'])
})

Deno.test('init command - handles project creation with single generator', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const createdProject: {
    name: string | null
    basePath: string | null
    generators: string[] | null
  } = { name: null, basePath: null, generators: null }

  skmtcRoot.createProject = async ({ name, basePath, generators }) => {
    createdProject.name = name
    createdProject.basePath = basePath
    createdProject.generators = generators
    const mockProject = (await import('../mocks/project.mock.ts')).createMockProject(manager, {
      name,
      generators
    })
    skmtcRoot.projects.push(mockProject)
    return mockProject
  }

  const command = toInitCommand(skmtcRoot)
  await command.parse(['simple-project', 'jsr:@skmtc/gen-typescript', './lib'])

  assertEquals(createdProject.name, 'simple-project')
  assertEquals(createdProject.basePath, './lib')
  assertEquals(createdProject.generators, ['jsr:@skmtc/gen-typescript'])
})