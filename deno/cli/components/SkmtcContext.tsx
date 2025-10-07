import React from 'react'
import { createContext, type ReactNode, useContext, useReducer } from 'react'
import { match, P } from 'ts-pattern'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Session } from '@supabase/supabase-js'
import type { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import type { Key } from 'ink'

export type ErrorMessage = {
  error: string
  sub?: string
}

export type SuccessMessage = {
  success: string
  sub?: string
}

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
      payload: ErrorMessage | SuccessMessage | null
    }
  | {
      type: 'add-shortcut'
      payload: Shortcut
    }
  | {
      type: 'remove-shortcut'
      payload: string
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
  schemaSourceString?: string
  watchMode?: boolean
}

export type ViewStateDeploy = {
  page: 'deploy'
  projectName: string
}
type ExecutionInfo = {
  type: 'generate' | 'deploy' | 'generate:watch' | 'serve'
  title: string
  subtitle?: string
}

export type ViewStateGenerateConfirmed = {
  page: 'generate'
  project: Project | RemoteProject
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
  page: 'add-generator'
  projectName: string
  generatorName?: string
  generatorType?: 'operation' | 'model'
  username?: string
}

export type ViewStateAddGeneratorConfirmed = {
  page: 'add-generator'
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

export type SkmtcState = {
  view: ViewState
  skmtcRoot: SkmtcRoot
  session: Session | null
  message: ErrorMessage | SuccessMessage | null
  interactive: boolean
  execution: ExecutionInfo | null
  shortcuts: Shortcut[]
}

type SkmtcProviderProps = {
  view: ViewState
  skmtcRoot: SkmtcRoot
  children: ReactNode
  session: Session | null
  interactive: boolean
}

const SkmtcStateContext = createContext<{ state: SkmtcState; dispatch: SkmtcDispatch } | undefined>(
  undefined
)

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
    .exhaustive()
}

const SkmtcProvider = ({ children, skmtcRoot, session, interactive, view }: SkmtcProviderProps) => {
  const [state, dispatch] = useReducer(skmtcReducer, {
    view,
    skmtcRoot,
    session,
    message: null,
    interactive,
    execution: null,
    shortcuts: []
  })
  // NOTE: you *might* need to memoize this value
  // Learn more in http://kcd.im/optimize-context
  const value = { state, dispatch }
  return <SkmtcStateContext.Provider value={value}>{children}</SkmtcStateContext.Provider>
}

const useSkmtc = () => {
  const context = useContext(SkmtcStateContext)

  if (context === undefined) {
    throw new Error('useSkmtc must be used within a SkmtcProvider')
  }

  return context
}

export { SkmtcProvider, useSkmtc }

type ToProjectNameArgs = {
  view: ViewState
}

export const toProjectName = ({ view }: ToProjectNameArgs) => {
  return match(view)
    .with({ project: P.any }, ({ project }) => project.name)
    .with({ projectName: P.string }, ({ projectName }) => projectName)
    .otherwise(() => 'home')
}

export const useProjectName = () => {
  const { state } = useSkmtc()

  return toProjectName({ view: state.view })
}
