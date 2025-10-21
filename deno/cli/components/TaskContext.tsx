import React from 'react'
import { createContext, type ReactNode, useContext, useReducer } from 'react'
import { match } from 'ts-pattern'

type SetCurrentTaskAction = { type: 'increment-current-task' }
type InsertTaskAction = { type: 'insert-task'; payload: InsertTaskPayload }

type SetStateAction = { type: 'set-task-state'; payload: SetStatePayload }

type SetStatePayload<TaskKey extends keyof TaskState = keyof TaskState> = {
  taskKey: TaskKey
  state: TaskState[TaskKey]
}

export type TaskAction = SetCurrentTaskAction | InsertTaskAction | SetStateAction

type InsertTaskPayload = {
  task: Task
  index: number
}

type TaskState = {
  'project-name': string
  generators: string[]
  'base-path': string
  'create-project': boolean
  'generator-type-task': 'operation' | 'model'
  'generator-name-task': string
  'start-server-task': undefined
  'display-output-directory-task': boolean
  'schema-location-task': string
  'watch-mode-task': boolean
  'generate-view-content-task': undefined
  'confirm-task': boolean
}

export type TaskDispatch = (action: TaskAction) => void

export type TaskContextState = {
  currentTask: number
  tasks: Task[]
}

type TaskProviderProps = {
  leave: () => void
  tasks: Task[]
  children: ReactNode
}

export type Task<TaskKey extends keyof TaskState = keyof TaskState> = {
  taskKey: TaskKey
  state: TaskState[TaskKey] | undefined
  include: boolean
  render: () => ReactNode
}

const TaskStateContext = createContext<
  { state: TaskContextState; dispatch: TaskDispatch; leave: () => void } | undefined
>(undefined)

const taskReducer = (state: TaskContextState, action: TaskAction) => {
  return match(action)
    .with({ type: 'increment-current-task' }, () => ({
      ...state,
      currentTask: state.currentTask + 1
    }))
    .with({ type: 'insert-task' }, ({ payload: { task, index } }) => ({
      ...state,
      tasks: [...state.tasks.slice(0, index), task, ...state.tasks.slice(index)]
    }))
    .with({ type: 'set-task-state' }, ({ payload }) => {
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.taskKey === payload.taskKey ? { ...task, state: payload.state } : task
        )
      }
    })
    .exhaustive()
}

const TaskProvider = ({ children, leave, tasks }: TaskProviderProps) => {
  const [state, dispatch] = useReducer(taskReducer, {
    currentTask: 0,
    tasks
  })

  // NOTE: you *might* need to memoize this value
  // Learn more in http://kcd.im/optimize-context
  const value = { state, dispatch, leave }
  return <TaskStateContext.Provider value={value}>{children}</TaskStateContext.Provider>
}

const useTask = () => {
  const context = useContext(TaskStateContext)

  if (context === undefined) {
    throw new Error('useTask must be used within a TaskProvider')
  }

  return context
}

export { TaskProvider, useTask }
