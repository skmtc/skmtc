import React from 'react'
import { createContext, type ReactNode, useContext, useReducer } from 'react'
import { match } from 'ts-pattern'

type TaskAction = { type: 'set-current-task'; payload: number }

export type TaskDispatch = (action: TaskAction) => void

export type TaskState = {
  currentTask: number
}

type TaskProviderProps = {
  leave: () => void
  children: ReactNode
}

type Task = {
  render: () => ReactNode
}

const TaskStateContext = createContext<
  { state: TaskState; dispatch: TaskDispatch; leave: () => void } | undefined
>(undefined)

const taskReducer = (state: TaskState, action: TaskAction) => {
  return match(action)
    .with({ type: 'set-current-task' }, ({ payload }) => ({ ...state, currentTask: payload }))
    .exhaustive()
}

const TaskProvider = ({ children, leave }: TaskProviderProps) => {
  const [state, dispatch] = useReducer(taskReducer, {
    currentTask: 0
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
