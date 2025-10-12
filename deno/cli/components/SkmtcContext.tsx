import React from 'react'
import { createContext, type ReactNode, useContext, useReducer, useEffect } from 'react'
import { match } from 'ts-pattern'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Session } from '@supabase/supabase-js'
import type { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import type { Key } from 'ink'
import type { Generator } from '@/types/generator.generated.ts'
import { getApiGenerators } from '../services/getApiGenerators.generated.ts'

export type ErrorMessage = {
  error: ReactNode
  sub?: string
}

export type InfoMessage = {
  info: ReactNode
  sub?: string
}

export type SuccessMessage = {
  success: ReactNode
  sub?: string
}

export type SkmtcMessage = ErrorMessage | SuccessMessage | InfoMessage

type SkmtcAction =
  | { type: 'set-view'; payload: ViewState }
  | {
      type: 'set-session'
      payload: {
        session: Session | null
      }
    }
  | {
      type: 'set-message'
      payload: TimedMessage | null
    }
  | {
      type: 'add-shortcut'
      payload: Shortcut
    }
  | {
      type: 'remove-shortcut'
      payload: string
    }
  | {
      type: 'set-generators'
      payload: Generator[]
    }

type Shortcut = {
  id: string
  label: string
  action: (input: string, key: Key) => void
}

export type SkmtcDispatch = (action: SkmtcAction) => void

export type ViewStateHome = {
  page: 'home'
}
export type ViewStateCreateProject = {
  page: 'create-project'
  projectName?: string
  generators?: string[]
  basePath?: string
}

export type ViewStateLogin = {
  page: 'login'
}

export type ViewStateProject = {
  page: 'project'
  projectName: string
}

export type ViewStateGenerate = {
  page: 'generate'
  project: Project | RemoteProject
  basePath?: string
  schemaSourceString?: string
  watchMode?: boolean
}

export type ViewStateDeploy = {
  page: 'deploy'
  projectName: string
}

export type ViewStateGenerateConfirmed = {
  page: 'generate'
  project: Project | RemoteProject
  basePath: string
  schemaSourceString: string
  watchMode: boolean
}

export type ViewStateRuntimeLogs = {
  page: 'runtime-logs'
  projectName: string
}

export type ViewStateServe = {
  page: 'serve'
  projectName: string
  port?: string
}

export type ViewStateListGenerators = {
  page: 'list-generators'
  projectName: string
}

export type ViewStateAddGenerator = {
  page: 'create-generator'
  projectName: string
  generatorName?: string
  generatorType?: 'operation' | 'model'
  username?: string
}

export type ViewStateAddGeneratorConfirmed = {
  page: 'create-generator'
  projectName: string
  generatorName: string
  generatorType: 'operation' | 'model'
  username: string
}

export type ViewStateInstallGenerator = {
  page: 'install-generator'
  projectName: string
}

export type ViewStateCloneGenerator = {
  page: 'clone-generator'
  projectName: string
}

export type ViewStateRemoveGenerator = {
  page: 'remove-generator'
  projectName: string
  generatorName?: string
}

export type ViewStateExit = {
  page: 'exit'
}

export type ViewState =
  | ViewStateHome
  | ViewStateCreateProject
  | ViewStateLogin
  | ViewStateProject
  | ViewStateGenerate
  | ViewStateDeploy
  | ViewStateRuntimeLogs
  | ViewStateServe
  | ViewStateListGenerators
  | ViewStateAddGenerator
  | ViewStateInstallGenerator
  | ViewStateCloneGenerator
  | ViewStateRemoveGenerator
  | ViewStateExit

export type TimedMessage = {
  content: SkmtcMessage
  timeout: number
}

export type SkmtcState = {
  view: ViewState
  skmtcRoot: SkmtcRoot
  session: Session | null
  message: TimedMessage | null
  interactive: boolean
  shortcuts: Shortcut[]
  generators: Generator[]
}

type SkmtcProviderProps = {
  children: ReactNode
  initialState: SkmtcState
  exit: () => void
}

const SkmtcStateContext = createContext<
  { state: SkmtcState; dispatch: SkmtcDispatch; exit: () => void } | undefined
>(undefined)

const skmtcReducer = (state: SkmtcState, action: SkmtcAction) => {
  return match(action)
    .with({ type: 'set-view' }, ({ payload }) => ({ ...state, view: payload }))
    .with({ type: 'set-session' }, ({ payload }) => ({ ...state, session: payload.session }))
    .with({ type: 'set-message' }, ({ payload }) => ({ ...state, message: payload }))
    .with({ type: 'add-shortcut' }, ({ payload }) => ({
      ...state,
      shortcuts: [...state.shortcuts, payload]
    }))
    .with({ type: 'remove-shortcut' }, ({ payload }) => ({
      ...state,
      shortcuts: state.shortcuts.filter(shortcut => shortcut.id !== payload)
    }))
    .with({ type: 'set-generators' }, ({ payload }) => ({ ...state, generators: payload }))
    .exhaustive()
}

const SkmtcProvider = ({ initialState, children, exit }: SkmtcProviderProps) => {
  const [state, dispatch] = useReducer(skmtcReducer, initialState)

  useInitialLoad({ state, dispatch })

  // NOTE: you *might* need to memoize this value
  // Learn more in http://kcd.im/optimize-context
  const value = { state, dispatch, exit }
  return <SkmtcStateContext.Provider value={value}>{children}</SkmtcStateContext.Provider>
}

const useSkmtc = () => {
  const context = useContext(SkmtcStateContext)

  if (context === undefined) {
    throw new Error('useSkmtc must be used within a SkmtcProvider')
  }

  const { dispatch, state, exit } = context

  const dispatchMessage = (payload: SkmtcMessage) => {
    const timeout = setTimeout(() => {
      dispatch({ type: 'set-message', payload: null })
    }, 30000)

    if (state.message?.timeout) {
      clearTimeout(state.message.timeout)
    }

    dispatch({ type: 'set-message', payload: { content: payload, timeout } })
  }

  return { state, dispatch, dispatchMessage, exit }
}

export { SkmtcProvider, useSkmtc }

type UseInitialLoadArgs = {
  state: SkmtcState
  dispatch: SkmtcDispatch
}

const useInitialLoad = ({ state, dispatch }: UseInitialLoadArgs) => {
  useEffect(() => {
    getApiGenerators({ supabase: state.skmtcRoot.manager.auth.supabase }).then(generators => {
      const sortedGenerators = generators.toSorted((a, b) =>
        a.packageName.localeCompare(b.packageName)
      )
      dispatch({ type: 'set-generators', payload: sortedGenerators })
    })
  }, [])
}

type ToProjectNameArgs = {
  view: ViewState
}

export const toProjectName = ({ view }: ToProjectNameArgs) => {
  return match(view)
    .with({ page: 'create-generator' }, ({ projectName }) => projectName)
    .with({ page: 'create-project' }, ({ projectName }) => projectName)
    .with({ page: 'project' }, ({ projectName }) => projectName)
    .with({ page: 'generate' }, ({ project }) => project.name)
    .with({ page: 'deploy' }, ({ projectName }) => projectName)
    .with({ page: 'serve' }, ({ projectName }) => projectName)
    .with({ page: 'runtime-logs' }, ({ projectName }) => projectName)
    .with({ page: 'list-generators' }, ({ projectName }) => projectName)
    .with({ page: 'install-generator' }, ({ projectName }) => projectName)
    .with({ page: 'clone-generator' }, ({ projectName }) => projectName)
    .with({ page: 'remove-generator' }, ({ projectName }) => projectName)
    .otherwise(() => undefined)
}

export const useProjectName = () => {
  const { state } = useSkmtc()

  return toProjectName({ view: state.view })
}
