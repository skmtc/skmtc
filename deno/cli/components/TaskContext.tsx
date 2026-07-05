import { createContext, type ReactNode, useContext, useReducer } from 'react'
import type { Project } from '@/lib/project.ts'

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

export type TaskState = {
  'project-name': string
  generators: string[]
  'base-path': string
  'create-project': Project | null
  'generator-type-task': 'operation' | 'model'
  'generator-name-task': string
  'display-output-directory-task': boolean
  'schema-location-task': string
  'watch-mode-task': boolean
  'generate-view-content-task': undefined
  'confirm-task': boolean
  'add-generator-task': undefined
  'select-project-task': Project
  'install-generators-task': boolean
  'generate-bundle-task': string
  'generate-worker-task': string
}

export type TaskDispatch = (action: TaskAction) => void

export type TaskContextState = {
  currentTask: number
  tasks: Task[]
}

type LeaveArgs = {
  state: Partial<TaskState>
}

type TaskProviderProps = {
  leave: (args: LeaveArgs) => void
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
  { state: TaskContextState; dispatch: TaskDispatch; leave: (args: LeaveArgs) => void } | undefined
>(undefined)

export const taskReducer = (state: TaskContextState, action: TaskAction) => {
  switch (action.type) {
    case 'increment-current-task': {
      return {
        ...state,
        currentTask: state.currentTask + 1
      }
    }
    case 'insert-task': {
      const { task, index } = action.payload
      return {
        ...state,
        tasks: [...state.tasks.slice(0, index), task, ...state.tasks.slice(index)]
      }
    }
    case 'set-task-state': {
      const { payload } = action
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.taskKey === payload.taskKey ? { ...task, state: payload.state } : task
        )
      }
    }
  }
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

export const tasksToState = (tasks: Task[]): Partial<TaskState> => {
  return Object.fromEntries(tasks.map(task => [task.taskKey, task.state]))
}
