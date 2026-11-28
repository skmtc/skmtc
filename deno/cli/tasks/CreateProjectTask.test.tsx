import { render } from 'ink-testing-library'
import { stub, spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { CreateProjectTask } from './CreateProjectTask.tsx'
import { Project } from '@/lib/project.ts'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { TaskProvider, type Task } from '@/components/TaskContext.tsx'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Generator } from '@/types/generator.ts'
import { stubRegistryGenerators } from '../tests/mocks/registry.mock.ts'
import { MessageBox } from '@/components/MessageBox.tsx'
import { assertStringIncludes } from '@std/assert/string-includes'
import { waitFor } from '@/test/wait-for.ts'

// Mock generators data
const mockGenerators: Generator[] = [
  {
    scope: 'skmtc',
    packageName: 'gen-typescript',
    dependencies: []
  },
  {
    scope: 'skmtc',
    packageName: 'gen-zod',
    dependencies: []
  }
]

// Mock setup helpers
const createMockSkmtcRoot = (): SkmtcRoot =>
  ({
    projects: [],
    manager: {}
  }) as unknown as SkmtcRoot

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

/**
 * Gives a second `leave` or `Project.create` call time to show up before a
 * test asserts there was only one. A correct run passes however long this
 * takes, so the sleep cannot make the test fail at random.
 */
const settleForSecondCall = () => new Promise(resolve => setTimeout(resolve, 300))

const createMockProject = () => ({
  name: 'test-project',
  toPath: () => '/path/to/test-project',
  rootDenoJson: {},
  clientJson: {},
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
  using projectCreateStub = stub(Project, 'create', () => Promise.reject(testError))

  // Spy on console.error
  using consoleErrorSpy = spy(console, 'error')

  // Create spy for leave function
  const leaveSpy = spy()

  // Mock the registry catalog response
  using fetchStub = stubRegistryGenerators(mockGenerators)

  // Create mock SkmtcRoot
  const mockSkmtcRoot = createMockSkmtcRoot()

  const skmtcState: SkmtcState = {
    view: { page: 'create-project' },
    skmtcRoot: mockSkmtcRoot,
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
  await waitFor(() => assertSpyCalls(leaveSpy, 1))
  // Still once: a second call would come from the effect running again
  await settleForSecondCall()
  assertSpyCalls(leaveSpy, 1)

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
    using projectCreateStub = stub(Project, 'create', () =>
      Promise.resolve(mockProject as unknown as Project)
    )

    // Create spy for leave function
    const leaveSpy = spy()

    // Mock the registry catalog response
    using fetchStub = stubRegistryGenerators(mockGenerators)

    // Create mock SkmtcRoot
    const mockSkmtcRoot = createMockSkmtcRoot()

    const skmtcState: SkmtcState = {
      view: { page: 'create-project' },
      skmtcRoot: mockSkmtcRoot,
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

    // Verify leave was called with task state
    await waitFor(() => assertSpyCalls(leaveSpy, 1))
    // Still once: a second call would come from the effect running again
    await settleForSecondCall()
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
    using projectCreateStub = stub(Project, 'create', () =>
      Promise.resolve(mockProject as unknown as Project)
    )

    // Mock the registry catalog response
    using fetchStub = stubRegistryGenerators(mockGenerators)

    const mockSkmtcRoot = createMockSkmtcRoot()

    const skmtcState: SkmtcState = {
      view: { page: 'create-project' },
      skmtcRoot: mockSkmtcRoot,
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
      await waitFor(() => assertSpyCalls(projectCreateStub, 1))
      // Still once: a second call would come from the effect running again
      await settleForSecondCall()
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
  }
})

Deno.test({
  name: 'CreateProjectTask - calls Project.create with correct parameters',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const mockProject = createMockProject()

    using projectCreateStub = stub(Project, 'create', () =>
      Promise.resolve(mockProject as unknown as Project)
    )

    using fetchStub = stubRegistryGenerators(mockGenerators)

    const mockSkmtcRoot = createMockSkmtcRoot()

    const skmtcState: SkmtcState = {
      view: { page: 'create-project' },
      skmtcRoot: mockSkmtcRoot,
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

    // Verify Project.create was called with the exact task state values
    await waitFor(() => assertSpyCalls(projectCreateStub, 1))
    // Still once: a second call would come from the effect running again
    await settleForSecondCall()
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
  }
})

// The trap: `skmtc init my-api ./src` at a terminal created the project with
// no word about an app whose `@/` points to another folder. Only the run
// with `--no-input` or `--json` printed the warning.
Deno.test({
  name: 'CreateProjectTask - warns when basePath is not the folder "@/" points to',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    using _projectCreateStub = stub(Project, 'create', () =>
      Promise.resolve(createMockProject() as unknown as Project)
    )
    using _fetchStub = stubRegistryGenerators(mockGenerators)

    const skmtcState: SkmtcState = {
      view: { page: 'create-project', aliasRoot: { path: 'app/src', from: 'tsconfig.json' } },
      skmtcRoot: createMockSkmtcRoot(),
      interactive: false,
      message: null,
      shortcuts: [],
      generators: []
    }

    const { lastFrame, unmount } = render(
      <SkmtcProvider initialState={skmtcState} exit={() => {}}>
        <TaskProvider leave={spy()} tasks={createMockTasks()}>
          <CreateProjectTask />
        </TaskProvider>
        <MessageBox />
      </SkmtcProvider>
    )

    await waitFor(() => {
      const frame = (lastFrame() ?? '').replace(/\s+/g, ' ')

      assertStringIncludes(frame, 'Project "test-project" created')
      assertStringIncludes(
        frame,
        'Warning: "@/" points to "app/src" (tsconfig.json), not to "./src"'
      )
    })

    unmount()
  }
})
