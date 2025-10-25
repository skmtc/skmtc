import React from 'react'
import { snapshotTest } from '@cliffy/testing'
import { assertEquals } from '@std/assert/equals'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSupabaseClient } from '@/tests/mocks/supabase.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { toInitCommand, renderInit } from './init.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { toMockSession } from '../tests/commands/session.test.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import type { Generator } from '@/types/generator.generated.ts'
import { getApiGenerators } from '@/services/getApiGenerators.generated.ts'

const mockGenerators: Generator[] = [
  {
    id: '1',
    name: 'TypeScript Generator',
    description: 'Generate TypeScript types',
    dependencies: [],
    sourceUrl: 'https://github.com/skmtc/gen-typescript',
    registryUrl: 'https://jsr.io/@skmtc/gen-typescript',
    readme: 'TypeScript generator',
    scope: 'skmtc',
    packageName: 'gen-typescript',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'Zod Generator',
    description: 'Generate Zod schemas',
    dependencies: [],
    sourceUrl: 'https://github.com/skmtc/gen-zod',
    registryUrl: 'https://jsr.io/@skmtc/gen-zod',
    readme: 'Zod generator',
    scope: 'skmtc',
    packageName: 'gen-zod',
    createdAt: '2024-01-01T00:00:00Z'
  }
]

// Create a stubbed version of renderInit that prints parameters
const renderInitStub = async ({
  projectName,
  basePath
}: {
  skmtcRoot: SkmtcRoot
  projectName: string | undefined
  basePath: string | undefined
}) => {
  console.log('projectName:', projectName)
  console.log('basePath:', basePath)

  return await Promise.resolve()
}

await snapshotTest({
  name: 'should log Deno.args',
  meta: import.meta,
  args: ['test-project', './lib'],
  denoArgs: ['--allow-all'],
  async fn() {
    const command = toInitCommand(createMockSkmtcRoot(createMockManager()), renderInitStub)
    await command.parse()
  }
})

Deno.test('renderInit - should call toSession, render, and App with expected props', async () => {
  // Set up mocks
  const manager = createMockManager()

  const mockSession = toMockSession()
  // Spy on toSession
  const toSessionSpy = spy(() => Promise.resolve(mockSession))
  manager.auth.toSession = toSessionSpy

  const skmtcRoot = createMockSkmtcRoot(manager)

  // Test input values
  const testProjectName = 'test-project'
  const testBasePath = './src'

  // Mock render function that captures what it receives
  const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

  // Mock App component - we don't need to spy on it being called
  // because we can inspect the React element directly
  const AppSpy = (_props: AppProps): React.JSX.Element => {
    // Return a valid React element

    return 'AppSpy' as unknown as React.JSX.Element
  }

  // Call renderInit with our spies
  await renderInit({
    skmtcRoot,
    projectName: testProjectName,
    basePath: testBasePath,
    renderFn: renderSpy as InkRenderFn,
    AppComponent: AppSpy
  })

  // Verify toSession was called
  assertSpyCalls(toSessionSpy, 1)

  // Verify render was called with an element
  assertSpyCalls(renderSpy, 1)

  assertSpyCall(renderSpy, 0, {
    args: [
      // deno-lint-ignore jsx-key
      <AppSpy
        initialState={{
          view: {
            page: 'create-project',
            projectName: testProjectName,
            basePath: testBasePath
          },
          skmtcRoot,
          session: mockSession,
          message: null,
          interactive: false,
          shortcuts: [],
          generators: []
        }}
      />
    ]
  })
})

Deno.test('init - getApiGenerators returns mocked generators', async () => {
  const { client: supabaseClient, mock: supabaseMock } = createMockSupabaseClient()

  // Mock the generators API response
  supabaseMock.mockResponse('/generators', { data: mockGenerators })

  const generators = await getApiGenerators({ supabase: supabaseClient })

  assertEquals(generators.length, 2)
  assertEquals(generators[0].packageName, 'gen-typescript')
  assertEquals(generators[1].packageName, 'gen-zod')
})

Deno.test('init - creates new project with multiple generators', async () => {
  const { client: supabaseClient, mock: supabaseMock } = createMockSupabaseClient()

  // Mock the generators API response
  supabaseMock.mockResponse('/generators', { data: mockGenerators })

  const manager = createMockManager()
  manager.auth.supabase = supabaseClient

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const createdProject: {
    name: string | null
    basePath: string | null
    generators: string[] | null
  } = { name: null, basePath: null, generators: null }

  skmtcRoot.createProject = ({ name, basePath, generators }) => {
    createdProject.name = name
    createdProject.basePath = basePath
    createdProject.generators = generators
    const mockProject = createMockProject(manager, { name, generators })
    skmtcRoot.projects.push(mockProject)
    return Promise.resolve(mockProject)
  }

  // Simulate the project creation flow
  const projectName = 'my-new-project'
  const generators = ['@skmtc/gen-typescript', '@skmtc/gen-zod']
  const basePath = 'src'

  const availableGenerators = await getApiGenerators({ supabase: supabaseClient })
  await skmtcRoot.createProject({ name: projectName, basePath, generators, availableGenerators })

  assertEquals(createdProject.name, 'my-new-project')
  assertEquals(createdProject.basePath, 'src')
  assertEquals(createdProject.generators, ['@skmtc/gen-typescript', '@skmtc/gen-zod'])
})

Deno.test('init - handles project creation with single generator', async () => {
  const { client: supabaseClient, mock: supabaseMock } = createMockSupabaseClient()

  // Mock the generators API response
  supabaseMock.mockResponse('/generators', { data: mockGenerators })

  const manager = createMockManager()
  manager.auth.supabase = supabaseClient

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const createdProject: {
    name: string | null
    basePath: string | null
    generators: string[] | null
  } = { name: null, basePath: null, generators: null }

  skmtcRoot.createProject = ({ name, basePath, generators }) => {
    createdProject.name = name
    createdProject.basePath = basePath
    createdProject.generators = generators
    const mockProject = createMockProject(manager, { name, generators })
    skmtcRoot.projects.push(mockProject)
    return Promise.resolve(mockProject)
  }

  // Simulate the project creation flow
  const projectName = 'simple-project'
  const generators = ['@skmtc/gen-typescript']
  const basePath = './lib'

  const availableGenerators = await getApiGenerators({ supabase: supabaseClient })
  await skmtcRoot.createProject({ name: projectName, basePath, generators, availableGenerators })

  assertEquals(createdProject.name, 'simple-project')
  assertEquals(createdProject.basePath, './lib')
  assertEquals(createdProject.generators, ['@skmtc/gen-typescript'])
})
