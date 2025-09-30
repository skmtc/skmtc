import { createContext, type ReactNode, useContext, useReducer } from 'react'
import { match } from 'ts-pattern'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Session } from '@supabase/supabase-js'

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
      payload: string | null
    }
  | {
      type: 'set-execution'
      payload: ExecutionInfo | null
    }

export type SkmtcDispatch = (action: SkmtcAction) => void

export type ViewStateHome = {
  page: 'home'
}
export type ViewStateCreateProject = {
  page: 'create-project'
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
  projectName: string
  schemaSourceString?: string
  watchMode?: boolean
}

export type ViewStateDeploy = {
  page: 'deploy'
  projectName: string
}
type ExecutionInfo = {
  type: 'generate' | 'deploy' | 'generate:watch'
  title: string
  subtitle?: string
}

export type ViewStateGenerateConfirmed = {
  page: 'generate'
  projectName: string
  schemaSourceString: string
  watchMode: boolean
}

export type ViewStateRuntimeLogs = {
  page: 'runtime-logs'
  projectName: string
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
  | ViewStateListGenerators
  | ViewStateAddGenerator
  | ViewStateInstallGenerator
  | ViewStateCloneGenerator
  | ViewStateRemoveGenerator

type State = {
  view: ViewState
  skmtcRoot: SkmtcRoot
  session: Session | null
  message: string | null
  interactive: boolean
  execution: ExecutionInfo | null
}

type SkmtcProviderProps = {
  view: ViewState
  skmtcRoot: SkmtcRoot
  children: ReactNode
  session: Session | null
  interactive: boolean
}

const SkmtcStateContext = createContext<{ state: State; dispatch: SkmtcDispatch } | undefined>(
  undefined
)

const skmtcReducer = (state: State, action: SkmtcAction) => {
  return match(action)
    .with({ type: 'set-view' }, ({ payload }) => ({ ...state, view: payload }))
    .with({ type: 'set-session' }, ({ payload }) => ({ ...state, session: payload.session }))
    .with({ type: 'set-message' }, ({ payload }) => ({ ...state, message: payload }))
    .with({ type: 'set-execution' }, ({ payload }) => ({ ...state, execution: payload }))
    .exhaustive()
}

const SkmtcProvider = ({ children, skmtcRoot, session, interactive, view }: SkmtcProviderProps) => {
  const [state, dispatch] = useReducer(skmtcReducer, {
    view,
    skmtcRoot,
    session,
    message: null,
    interactive,
    execution: null
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
