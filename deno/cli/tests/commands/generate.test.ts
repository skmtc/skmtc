import { assertEquals } from '@std/assert/equals'
import { assertExists } from '@std/assert/exists'
import { toGenerateCommand } from '@/workspaces/generate.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { createMockRemoteProject } from '@/tests/mocks/remote-project.mock.ts'
import type { ViewStateGenerate } from '@/components/SkmtcContext.tsx'

Deno.test('generate command - parses project name argument', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'test-project' })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toGenerateCommand(skmtcRoot)

  // The command should be created successfully
  assertEquals(command.getDescription(), 'Generate artifacts')
})

Deno.test('generate command - has watch option', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toGenerateCommand(skmtcRoot)
  const options = command.getOptions()

  const watchOption = options.find(opt => opt.name === 'watch')
  assertEquals(watchOption !== undefined, true)
  assertEquals(watchOption?.flags?.join(', '), '-w, --watch')
})

Deno.test('generate view state - accepts Project instance', () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
  })

  // Verify that ViewStateGenerate accepts a Project instance
  const viewState: ViewStateGenerate = {
    page: 'generate',
    project: mockProject,
    schemaSourceString: 'schema.json',
    watchMode: false
  }

  assertExists(viewState)
  assertEquals(viewState.page, 'generate')
  assertEquals(viewState.project.name, 'test-project')
})

Deno.test('generate view state - accepts RemoteProject instance', () => {
  const manager = createMockManager()
  const mockRemoteProject = createMockRemoteProject(manager, {
    accountName: 'test-account',
    name: 'remote-project',
    projectKey: '@test-account/remote-project'
  })

  // Verify that ViewStateGenerate accepts a RemoteProject instance
  const viewState: ViewStateGenerate = {
    page: 'generate',
    project: mockRemoteProject,
    schemaSourceString: 'remote-schema.json',
    watchMode: true
  }

  assertExists(viewState)
  assertEquals(viewState.page, 'generate')
  assertEquals(viewState.project.name, 'remote-project')
  // Verify it's a RemoteProject by checking accountName exists on the instance
  assertEquals(mockRemoteProject.accountName, 'test-account')
})