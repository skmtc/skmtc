import { assertEquals, assertNotStrictEquals } from '@std/assert'
import { tasksToState, taskReducer } from './TaskContext.tsx'
import type { Task, TaskContextState, TaskAction } from './TaskContext.tsx'

// Test fixtures
const createMockTask = (
  taskKey: keyof Task['state'] extends never ? string : Task['taskKey'],
  state: Task['state'],
  include = true
): Task => ({
  taskKey: taskKey as Task['taskKey'],
  state,
  include,
  render: () => null
})

const mockTasks: Task[] = [
  createMockTask('project-name', 'test-project'),
  createMockTask('generators', ['@skmtc/gen-typescript', '@skmtc/gen-zod']),
  createMockTask('base-path', './src')
]

const createMockState = (currentTask = 0, tasks: Task[] = mockTasks): TaskContextState => ({
  currentTask,
  tasks
})

// ============================================================================
// tasksToState Tests
// ============================================================================

Deno.test('tasksToState - converts empty array to empty object', () => {
  const tasks: Task[] = []
  const result = tasksToState(tasks)
  assertEquals(result, {})
})

Deno.test('tasksToState - converts single task with state', () => {
  const tasks: Task[] = [createMockTask('project-name', 'my-project')]
  const result = tasksToState(tasks)
  assertEquals(result, { 'project-name': 'my-project' })
})

Deno.test('tasksToState - includes task with undefined state', () => {
  const tasks: Task[] = [createMockTask('create-project', undefined)]
  const result = tasksToState(tasks)
  assertEquals(result, { 'create-project': undefined })
})

Deno.test('tasksToState - converts multiple tasks with mixed states', () => {
  const tasks: Task[] = [
    createMockTask('project-name', 'test-project'),
    createMockTask('generators', ['@skmtc/gen-typescript']),
    createMockTask('base-path', './output'),
    createMockTask('create-project', undefined)
  ]
  const result = tasksToState(tasks)
  assertEquals(result, {
    'project-name': 'test-project',
    generators: ['@skmtc/gen-typescript'],
    'base-path': './output',
    'create-project': undefined
  })
})

Deno.test('tasksToState - handles all TaskState key types', () => {
  const tasks: Task[] = [
    createMockTask('project-name', 'proj'),
    createMockTask('generators', ['gen1']),
    createMockTask('base-path', './'),
    createMockTask('create-project', true),
    createMockTask('generator-type-task', 'operation'),
    createMockTask('generator-name-task', 'my-gen'),
    createMockTask('start-server-task', undefined),
    createMockTask('display-output-directory-task', false),
    createMockTask('schema-location-task', './schema.yaml'),
    createMockTask('watch-mode-task', true),
    createMockTask('generate-view-content-task', undefined),
    createMockTask('confirm-task', true),
    createMockTask('add-generator-task', undefined),
    createMockTask('create-project-task', null)
  ]
  const result = tasksToState(tasks)

  assertEquals(Object.keys(result).length, 14)
  assertEquals(result['project-name'], 'proj')
  assertEquals(result['generator-type-task'], 'operation')
  assertEquals(result['create-project-task'], null)
})

Deno.test('tasksToState - last task wins with duplicate taskKeys', () => {
  const tasks: Task[] = [
    createMockTask('project-name', 'first-project'),
    createMockTask('project-name', 'second-project')
  ]
  const result = tasksToState(tasks)
  assertEquals(result, { 'project-name': 'second-project' })
})

Deno.test('tasksToState - preserves include:false tasks in output', () => {
  const tasks: Task[] = [
    createMockTask('project-name', 'test', true),
    createMockTask('generators', ['gen'], false),
    createMockTask('base-path', './', false)
  ]
  const result = tasksToState(tasks)
  assertEquals(result, {
    'project-name': 'test',
    generators: ['gen'],
    'base-path': './'
  })
})

// ============================================================================
// taskReducer - increment-current-task Tests
// ============================================================================

Deno.test('taskReducer - increment-current-task increases from 0 to 1', () => {
  const initialState = createMockState(0)
  const action: TaskAction = { type: 'increment-current-task' }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.currentTask, 1)
  assertEquals(newState.tasks, initialState.tasks)
})

Deno.test('taskReducer - increment-current-task increases from non-zero value', () => {
  const initialState = createMockState(5)
  const action: TaskAction = { type: 'increment-current-task' }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.currentTask, 6)
})

Deno.test('taskReducer - increment-current-task preserves tasks array', () => {
  const initialState = createMockState(0)
  const action: TaskAction = { type: 'increment-current-task' }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.tasks, initialState.tasks)
  assertEquals(newState.tasks.length, mockTasks.length)
})

Deno.test('taskReducer - increment-current-task returns new state object', () => {
  const initialState = createMockState(0)
  const action: TaskAction = { type: 'increment-current-task' }

  const newState = taskReducer(initialState, action)

  assertNotStrictEquals(newState, initialState)
})

// ============================================================================
// taskReducer - insert-task Tests
// ============================================================================

Deno.test('taskReducer - insert-task at beginning (index 0)', () => {
  const initialState = createMockState(0)
  const newTask = createMockTask('confirm-task', true)
  const action: TaskAction = {
    type: 'insert-task',
    payload: { task: newTask, index: 0 }
  }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.tasks.length, mockTasks.length + 1)
  assertEquals(newState.tasks[0], newTask)
  assertEquals(newState.tasks[1], mockTasks[0])
})

Deno.test('taskReducer - insert-task in middle', () => {
  const initialState = createMockState(0)
  const newTask = createMockTask('confirm-task', false)
  const action: TaskAction = {
    type: 'insert-task',
    payload: { task: newTask, index: 1 }
  }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.tasks.length, mockTasks.length + 1)
  assertEquals(newState.tasks[0], mockTasks[0])
  assertEquals(newState.tasks[1], newTask)
  assertEquals(newState.tasks[2], mockTasks[1])
})

Deno.test('taskReducer - insert-task at end', () => {
  const initialState = createMockState(0)
  const newTask = createMockTask('confirm-task', true)
  const action: TaskAction = {
    type: 'insert-task',
    payload: { task: newTask, index: mockTasks.length }
  }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.tasks.length, mockTasks.length + 1)
  assertEquals(newState.tasks[mockTasks.length], newTask)
})

Deno.test('taskReducer - insert-task into empty tasks array', () => {
  const initialState = createMockState(0, [])
  const newTask = createMockTask('project-name', 'new-project')
  const action: TaskAction = {
    type: 'insert-task',
    payload: { task: newTask, index: 0 }
  }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.tasks.length, 1)
  assertEquals(newState.tasks[0], newTask)
})

Deno.test('taskReducer - insert-task preserves currentTask value', () => {
  const initialState = createMockState(2)
  const newTask = createMockTask('confirm-task', true)
  const action: TaskAction = {
    type: 'insert-task',
    payload: { task: newTask, index: 0 }
  }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.currentTask, 2)
})

Deno.test('taskReducer - insert-task returns new state and tasks array', () => {
  const initialState = createMockState(0)
  const newTask = createMockTask('confirm-task', true)
  const action: TaskAction = {
    type: 'insert-task',
    payload: { task: newTask, index: 1 }
  }

  const newState = taskReducer(initialState, action)

  assertNotStrictEquals(newState, initialState)
  assertNotStrictEquals(newState.tasks, initialState.tasks)
})

// ============================================================================
// taskReducer - set-task-state Tests
// ============================================================================

Deno.test('taskReducer - set-task-state updates existing task state', () => {
  const initialState = createMockState(0)
  const action: TaskAction = {
    type: 'set-task-state',
    payload: { taskKey: 'project-name', state: 'updated-project' }
  }

  const newState = taskReducer(initialState, action)

  const updatedTask = newState.tasks.find(t => t.taskKey === 'project-name')
  assertEquals(updatedTask?.state, 'updated-project')
})

Deno.test('taskReducer - set-task-state changes undefined to defined state', () => {
  const tasksWithUndefined = [
    createMockTask('project-name', undefined),
    createMockTask('generators', ['gen'])
  ]
  const initialState = createMockState(0, tasksWithUndefined)
  const action: TaskAction = {
    type: 'set-task-state',
    payload: { taskKey: 'project-name', state: 'now-defined' }
  }

  const newState = taskReducer(initialState, action)

  const updatedTask = newState.tasks.find(t => t.taskKey === 'project-name')
  assertEquals(updatedTask?.state, 'now-defined')
})

Deno.test('taskReducer - set-task-state updates only targeted task', () => {
  const initialState = createMockState(0)
  const action: TaskAction = {
    type: 'set-task-state',
    payload: { taskKey: 'generators', state: ['@skmtc/new-gen'] }
  }

  const newState = taskReducer(initialState, action)

  const projectNameTask = newState.tasks.find(t => t.taskKey === 'project-name')
  const generatorsTask = newState.tasks.find(t => t.taskKey === 'generators')
  const basePathTask = newState.tasks.find(t => t.taskKey === 'base-path')

  assertEquals(projectNameTask?.state, 'test-project') // unchanged
  assertEquals(generatorsTask?.state, ['@skmtc/new-gen']) // updated
  assertEquals(basePathTask?.state, './src') // unchanged
})

Deno.test('taskReducer - set-task-state handles non-existent taskKey gracefully', () => {
  const initialState = createMockState(0)
  const action: TaskAction = {
    type: 'set-task-state',
    payload: { taskKey: 'confirm-task', state: true }
  }

  const newState = taskReducer(initialState, action)

  // State should be unchanged since taskKey doesn't exist
  assertEquals(newState.tasks.length, initialState.tasks.length)
  assertEquals(newState.tasks, newState.tasks)
})

Deno.test('taskReducer - set-task-state preserves currentTask value', () => {
  const initialState = createMockState(3)
  const action: TaskAction = {
    type: 'set-task-state',
    payload: { taskKey: 'project-name', state: 'new-name' }
  }

  const newState = taskReducer(initialState, action)

  assertEquals(newState.currentTask, 3)
})

Deno.test('taskReducer - set-task-state returns new state object', () => {
  const initialState = createMockState(0)
  const action: TaskAction = {
    type: 'set-task-state',
    payload: { taskKey: 'project-name', state: 'new-project' }
  }

  const newState = taskReducer(initialState, action)

  assertNotStrictEquals(newState, initialState)
  assertNotStrictEquals(newState.tasks, initialState.tasks)
})

// ============================================================================
// taskReducer - Edge Cases
// ============================================================================

Deno.test('taskReducer - all actions maintain state immutability', () => {
  const initialState = createMockState(1)
  const originalTasks = initialState.tasks
  const originalCurrentTask = initialState.currentTask

  const actions: TaskAction[] = [
    { type: 'increment-current-task' },
    { type: 'insert-task', payload: { task: createMockTask('confirm-task', true), index: 0 } },
    { type: 'set-task-state', payload: { taskKey: 'project-name', state: 'changed' } }
  ]

  actions.forEach(action => {
    const newState = taskReducer(initialState, action)

    // Original state should be unchanged
    assertEquals(initialState.currentTask, originalCurrentTask)
    assertEquals(initialState.tasks, originalTasks)

    // New state should be different object
    assertNotStrictEquals(newState, initialState)
  })
})

Deno.test('taskReducer - preserves task properties other than state', () => {
  const customRenderFn = () => 'custom'
  const customTask = {
    taskKey: 'project-name' as const,
    state: 'initial',
    include: false,
    render: customRenderFn
  }
  const initialState = createMockState(0, [customTask])

  const action: TaskAction = {
    type: 'set-task-state',
    payload: { taskKey: 'project-name', state: 'updated' }
  }

  const newState = taskReducer(initialState, action)

  const updatedTask = newState.tasks[0]
  assertEquals(updatedTask.state, 'updated')
  assertEquals(updatedTask.include, false)
  assertEquals(updatedTask.render, customRenderFn)
  assertEquals(updatedTask.taskKey, 'project-name')
})
