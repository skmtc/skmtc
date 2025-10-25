import React from 'react'
import { render } from 'ink-testing-library'
import { stub, spy, assertSpyCalls, assertSpyCall, returnsNext } from '@std/testing/mock'
import { assertEquals } from '@std/assert'
import { CreateProjectTask } from './CreateProjectTask.tsx'
import { Project } from '@/lib/project.ts'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { TaskProvider, type Task } from '@/components/TaskContext.tsx'
import { createTestSession } from '../tests/mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Generator } from '@/types/generator.generated.ts'
import { createMockSupabaseClient } from '../tests/mocks/supabase.mock.ts'

// Mock generators data
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

// Mock setup helpers
const createMockSkmtcRoot = (dispatchMessage: (msg: unknown) => void): SkmtcRoot => {
  const { client } = createMockSupabaseClient()

  return {
    projects: [],
    manager: {
      auth: {
        supabase: client
      }
    }
  } as unknown as SkmtcRoot
}

const createMockTasks = (): Task[] => [
  {
    taskKey: 'project-name',
    state: 'test-project',
    include: true,
    render: () => null
  },
  {
    taskKey: 'generators',
    state: ['@skmtc/gen-typescript', '@skmtc/gen-zod'],
    include: true,
    render: () => null
  },
  {
    taskKey: 'base-path',
    state: './src',
    include: true,
    render: () => null
  }
]

const createMockProject = () => ({
  name: 'test-project',
  toPath: () => '/path/to/test-project',
  rootDenoJson: {},
  clientJson: {},
  prettierJson: null,
  manifest: {},
  manager: {},
  schemaFile: {}
})

// ============================================================================
// CreateProjectTask Error Handling Tests
// ============================================================================

Deno.test('CreateProjectTask - handles Project.create error correctly', async () => {
  // Create error to throw
  const testError = new Error('Failed to create project directory')

  // Stub Project.create to throw error
  using projectCreateStub = stub(
    Project,
    'create',
    () => Promise.reject(testError)
  )

  // Spy on console.error
  using consoleErrorSpy = spy(console, 'error')

  // Create spy for leave function
  const leaveSpy = spy()

  // Mock generators API response
  const { client: supabaseClient, mock: supabaseMock } = createMockSupabaseClient()
  supabaseMock.mockResponse('/generators', { data: mockGenerators })

  // Create mock SkmtcRoot
  const mockSkmtcRoot: SkmtcRoot = {
    projects: [],
    manager: {
      auth: {
        supabase: supabaseClient
      }
    }
  } as unknown as SkmtcRoot

  const skmtcState: SkmtcState = {
    view: { page: 'create-project' },
    skmtcRoot: mockSkmtcRoot,
    session: createTestSession(),
    interactive: false,
    message: null,
    shortcuts: [],
    generators: []
  }

  // Setup tasks with required values
  const tasks = createMockTasks()

  const { unmount } = render(
    <SkmtcProvider initialState={skmtcState} exit={() => {}}>
      <TaskProvider leave={leaveSpy} tasks={tasks}>
        <CreateProjectTask />
      </TaskProvider>
    </SkmtcProvider>
  )

  // Wait for generators to load and error to occur
  await new Promise(resolve => setTimeout(resolve, 300))

  // Verify console.error was called with the error
  assertSpyCalls(consoleErrorSpy, 1)
  assertSpyCall(consoleErrorSpy, 0, { args: [testError] })

  // Verify leave was called with current task state
  assertSpyCalls(leaveSpy, 1)
  assertSpyCall(leaveSpy, 0, {
    args: [
      {
        state: {
          'project-name': 'test-project',
          generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod'],
          'base-path': './src'
        }
      }
    ]
  })

  unmount()
})

// ============================================================================
// CreateProjectTask Success Tests
// ============================================================================

Deno.test({
  name: 'CreateProjectTask - handles successful project creation',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const mockProject = createMockProject()

    // Stub Project.create to succeed
    using projectCreateStub = stub(
      Project,
      'create',
      () => Promise.resolve(mockProject as unknown as Project)
    )

    // Create spy for leave function
    const leaveSpy = spy()

    // Mock generators API response
    const { client: supabaseClient, mock: supabaseMock } = createMockSupabaseClient()
    supabaseMock.mockResponse('/generators', { data: mockGenerators })

    // Create mock SkmtcRoot
    const mockSkmtcRoot: SkmtcRoot = {
      projects: [],
      manager: {
        auth: {
          supabase: supabaseClient
        }
      }
    } as unknown as SkmtcRoot

    const skmtcState: SkmtcState = {
      view: { page: 'create-project' },
      skmtcRoot: mockSkmtcRoot,
      session: createTestSession(),
      interactive: false,
      message: null,
      shortcuts: [],
      generators: []
    }

    // Setup tasks with required values
    const tasks = createMockTasks()

    const { unmount } = render(
      <SkmtcProvider initialState={skmtcState} exit={() => {}}>
        <TaskProvider leave={leaveSpy} tasks={tasks}>
          <CreateProjectTask />
        </TaskProvider>
      </SkmtcProvider>
    )

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 300))

    // Verify leave was called with task state
    assertSpyCalls(leaveSpy, 1)
    assertSpyCall(leaveSpy, 0, {
      args: [
        {
          state: {
            'project-name': 'test-project',
            generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod'],
            'base-path': './src'
          }
        }
      ]
    })

    unmount()
  }
})

Deno.test({
  name: 'CreateProjectTask - waits for availableGenerators before calling Project.create',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
  const mockProject = createMockProject()

  // Stub Project.create to succeed
  using projectCreateStub = stub(
    Project,
    'create',
    () => Promise.resolve(mockProject as unknown as Project)
  )

  // Mock generators API response that takes time to load
  const { client: supabaseClient, mock: supabaseMock } = createMockSupabaseClient()
  supabaseMock.mockResponse('/generators', { data: mockGenerators })

  const mockSkmtcRoot: SkmtcRoot = {
    projects: [],
    manager: {
      auth: {
        supabase: supabaseClient
      }
    }
  } as unknown as SkmtcRoot

  const skmtcState: SkmtcState = {
    view: { page: 'create-project' },
    skmtcRoot: mockSkmtcRoot,
    session: createTestSession(),
    interactive: false,
    message: null,
    shortcuts: [],
    generators: []
  }

  const tasks = createMockTasks()

  const { unmount } = render(
    <SkmtcProvider initialState={skmtcState} exit={() => {}}>
      <TaskProvider leave={() => {}} tasks={tasks}>
        <CreateProjectTask />
      </TaskProvider>
    </SkmtcProvider>
  )

  try {
    // Wait for generators to load and Project.create to be called
    await new Promise(resolve => setTimeout(resolve, 300))

    // Verify Project.create was called
    assertSpyCalls(projectCreateStub, 1)

    // Verify it was called with correct arguments
    assertSpyCall(projectCreateStub, 0, {
      args: [
        {
          skmtcRoot: mockSkmtcRoot,
          name: 'test-project',
          basePath: './src',
          generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod'],
          availableGenerators: mockGenerators
        }
      ]
    })
  } finally {
    unmount()
  }
}})

Deno.test({
  name: 'CreateProjectTask - calls Project.create with correct parameters',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
  const mockProject = createMockProject()

  using projectCreateStub = stub(
    Project,
    'create',
    () => Promise.resolve(mockProject as unknown as Project)
  )

  const { client: supabaseClient, mock: supabaseMock } = createMockSupabaseClient()
  supabaseMock.mockResponse('/generators', { data: mockGenerators })

  const mockSkmtcRoot: SkmtcRoot = {
    projects: [],
    manager: {
      auth: {
        supabase: supabaseClient
      }
    }
  } as unknown as SkmtcRoot

  const skmtcState: SkmtcState = {
    view: { page: 'create-project' },
    skmtcRoot: mockSkmtcRoot,
    session: createTestSession(),
    interactive: false,
    message: null,
    shortcuts: [],
    generators: []
  }

  const tasks: Task[] = [
    {
      taskKey: 'project-name',
      state: 'my-custom-project',
      include: true,
      render: () => null
    },
    {
      taskKey: 'generators',
      state: ['@skmtc/gen-zod'],
      include: true,
      render: () => null
    },
    {
      taskKey: 'base-path',
      state: './output',
      include: true,
      render: () => null
    }
  ]

  const TestWrapper = () => (
    <SkmtcProvider initialState={skmtcState} exit={() => {}}>
      <TaskProvider leave={() => {}} tasks={tasks}>
        <CreateProjectTask />
      </TaskProvider>
    </SkmtcProvider>
  )

  const { unmount } = render(<TestWrapper />)

  await new Promise(resolve => setTimeout(resolve, 200))

  // Verify Project.create was called with the exact task state values
  assertSpyCalls(projectCreateStub, 1)
  assertSpyCall(projectCreateStub, 0, {
    args: [
      {
        skmtcRoot: mockSkmtcRoot,
        name: 'my-custom-project',
        basePath: './output',
        generators: ['@skmtc/gen-zod'],
        availableGenerators: mockGenerators
      }
    ]
  })

  unmount()
}})
