import React from 'react'
import { createContext, type ReactNode, useContext, useReducer } from 'react'
import { match } from 'ts-pattern'

type SetCurrentTaskAction = { type: 'increment-current-task' }
type InsertTaskAction = { type: 'insert-task'; payload: InsertTaskPayload }

export type TaskAction = SetCurrentTaskAction | InsertTaskAction

type InsertTaskPayload = {
  task: Task
  index: number
}

export type TaskDispatch = (action: TaskAction) => void

export type TaskState = {
  currentTask: number
  tasks: Task[]
}

type TaskProviderProps = {
  leave: () => void
  tasks: Task[]
  children: ReactNode
}

export type Task = {
  key: string
  include: boolean
  render: () => ReactNode
}

const TaskStateContext = createContext<
  { state: TaskState; dispatch: TaskDispatch; leave: () => void } | undefined
>(undefined)

const taskReducer = (state: TaskState, action: TaskAction) => {
  return match(action)
    .with({ type: 'increment-current-task' }, () => ({
      ...state,
      currentTask: state.currentTask + 1
    }))
    .with({ type: 'insert-task' }, ({ payload: { task, index } }) => ({
      ...state,
      tasks: [...state.tasks.slice(0, index), task, ...state.tasks.slice(index)]
    }))
    .exhaustive()
}

const TaskProvider = ({ children, leave, tasks }: TaskProviderProps) => {
  const [state, dispatch] = useReducer(taskReducer, {
    currentTask: 0,
    tasks
  })

  console.log('CURRENT TASK: ', state.currentTask)

  state.tasks.forEach((task, index) => {
    console.log('TASK: ', task.key, index)
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
