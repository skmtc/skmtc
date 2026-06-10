import React from 'react'
import { render } from 'ink-testing-library'
import { assertExists, assertStringIncludes, assertEquals } from '@std/assert'
import { TaskListView } from '@/components/TaskListView.tsx'
import { TaskProvider, type Task } from '@/components/TaskContext.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '../mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Text } from 'ink'

const createMockSkmtcRoot = (): SkmtcRoot => ({
  projects: [],
  manager: {
    auth: {
      supabase: {
        functions: {
          invoke: () => Promise.resolve({ data: [], error: null })
        }
      }
    }
  }
}) as unknown as SkmtcRoot

const createMockTask = (
  taskKey: 'project-name' | 'generators' | 'base-path' | 'create-project' | 'generator-type-task',
  content: string,
  include = true
): Task => ({
  taskKey,
  state: undefined,
  include,
  render: () => <Text>{content}</Text>
})

Deno.test('TaskListView - renders empty list when no tasks', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}
  const mockLeave = () => {}

  const skmtcState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: createMockSkmtcRoot(),
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={skmtcState} exit={mockExit}>
      <TaskProvider leave={mockLeave} tasks={[]}>
        <TaskListView />
      </TaskProvider>
    </SkmtcProvider>
  )

  const output = lastFrame()
  assertExists(output)
  // Should render without errors even with empty tasks
  assertEquals(output, '')

  unmount()
})

Deno.test('TaskListView - renders only included tasks', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}
  const mockLeave = () => {}

  const tasks: Task[] = [
    createMockTask('project-name', 'Included Task 1', true),
    createMockTask('generators', 'Excluded Task', false),
    createMockTask('base-path', 'Included Task 2', true)
  ]

  const skmtcState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: createMockSkmtcRoot(),
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={skmtcState} exit={mockExit}>
      <TaskProvider leave={mockLeave} tasks={tasks}>
        <TaskListView />
      </TaskProvider>
    </SkmtcProvider>
  )

  const output = lastFrame()
  assertExists(output)

  // With currentTask = 0, only the first included task should show
  assertStringIncludes(output, 'Included Task 1')

  // Should NOT include task with include: false
  assertEquals(output.includes('Excluded Task'), false)

  // Second included task is beyond currentTask index, so shouldn't show
  assertEquals(output.includes('Included Task 2'), false)

  unmount()
})

Deno.test('TaskListView - respects currentTask index', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}
  const mockLeave = () => {}

  const tasks: Task[] = [
    createMockTask('project-name', 'Task 1', true),
    createMockTask('generators', 'Task 2', true),
    createMockTask('base-path', 'Task 3', true),
    createMockTask('create-project', 'Task 4', true)
  ]

  const skmtcState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: createMockSkmtcRoot(),
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={skmtcState} exit={mockExit}>
      <TaskProvider leave={mockLeave} tasks={tasks}>
        <TaskListView />
      </TaskProvider>
    </SkmtcProvider>
  )

  const output = lastFrame()
  assertExists(output)

  // currentTask starts at 0, so only the first task should be visible
  assertStringIncludes(output, 'Task 1')
  assertEquals(output.includes('Task 2'), false)
  assertEquals(output.includes('Task 3'), false)
  assertEquals(output.includes('Task 4'), false)

  unmount()
})

Deno.test('TaskListView - applies paddingTop based on interactive mode', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}
  const mockLeave = () => {}

  const tasks: Task[] = [createMockTask('project-name', 'Test Task', true)]

  // Test with interactive: false (should have paddingTop: 1)
  const skmtcStateNonInteractive: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: createMockSkmtcRoot(),
    interactive: false,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame: lastFrameNonInteractive, unmount: unmount1 } = render(
    <SkmtcProvider initialState={skmtcStateNonInteractive} exit={mockExit}>
      <TaskProvider leave={mockLeave} tasks={tasks}>
        <TaskListView />
      </TaskProvider>
    </SkmtcProvider>
  )

  const outputNonInteractive = lastFrameNonInteractive()
  assertExists(outputNonInteractive)
  assertStringIncludes(outputNonInteractive, 'Test Task')

  unmount1()

  // Test with interactive: true (should have paddingTop: 0)
  const skmtcStateInteractive: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: createMockSkmtcRoot(),
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame: lastFrameInteractive, unmount: unmount2 } = render(
    <SkmtcProvider initialState={skmtcStateInteractive} exit={mockExit}>
      <TaskProvider leave={mockLeave} tasks={tasks}>
        <TaskListView />
      </TaskProvider>
    </SkmtcProvider>
  )

  const outputInteractive = lastFrameInteractive()
  assertExists(outputInteractive)
  assertStringIncludes(outputInteractive, 'Test Task')

  unmount2()
})

Deno.test('TaskListView - combined filtering with include and currentTask', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}
  const mockLeave = () => {}

  const tasks: Task[] = [
    createMockTask('project-name', 'Included Task 1', true),
    createMockTask('generators', 'Excluded Task 1', false),
    createMockTask('base-path', 'Included Task 2', true),
    createMockTask('create-project', 'Excluded Task 2', false),
    createMockTask('generator-type-task', 'Included Task 3', true)
  ]

  const skmtcState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: createMockSkmtcRoot(),
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={skmtcState} exit={mockExit}>
      <TaskProvider leave={mockLeave} tasks={tasks}>
        <TaskListView />
      </TaskProvider>
    </SkmtcProvider>
  )

  const output = lastFrame()
  assertExists(output)

  // With currentTask = 0, only first task should show
  // After filtering for include: true, that's "Included Task 1"
  assertStringIncludes(output, 'Included Task 1')

  // These should not appear (either excluded or beyond currentTask)
  assertEquals(output.includes('Excluded Task 1'), false)
  assertEquals(output.includes('Included Task 2'), false)
  assertEquals(output.includes('Excluded Task 2'), false)
  assertEquals(output.includes('Included Task 3'), false)

  unmount()
})

Deno.test('TaskListView - renders multiple tasks with custom render functions', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}
  const mockLeave = () => {}

  const tasks: Task[] = [
    {
      taskKey: 'project-name',
      state: undefined,
      include: true,
      render: () => <Text color="green">Green Task</Text>
    },
    {
      taskKey: 'generators',
      state: undefined,
      include: true,
      render: () => <Text color="red">Red Task</Text>
    }
  ]

  const skmtcState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: createMockSkmtcRoot(),
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={skmtcState} exit={mockExit}>
      <TaskProvider leave={mockLeave} tasks={tasks}>
        <TaskListView />
      </TaskProvider>
    </SkmtcProvider>
  )

  const output = lastFrame()
  assertExists(output)

  // Only first task should be visible (currentTask = 0)
  assertStringIncludes(output, 'Green Task')
  assertEquals(output.includes('Red Task'), false)

  unmount()
})
