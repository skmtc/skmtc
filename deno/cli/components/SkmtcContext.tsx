import React from 'react'
import { createContext, type ReactNode, useContext, useReducer } from 'react'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Project } from '@/lib/project.ts'
import type { Key } from 'ink'
import type { Generator } from '@/types/generator.ts'

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
      type: 'set-message'
      payload: AppMessage | null
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

export type ViewStateProject = {
  page: 'project'
  projectName: string
}

export type ViewStateGenerate = {
  page: 'generate'
  project: Project
  schemaSourceString?: string
  watchMode?: boolean
}

export type ViewStatePublish = {
  page: 'publish'
  projectName: string
  /** PAT for the hub. From --token or `SKMTC_HUB_TOKEN`. */
  token?: string
  /** Hub origin (base URL) override (defaults to https://api.skmtc.dev or
   *  `SKMTC_API_ORIGIN`). */
  origin?: string
  /** Version override from --version. Defaults to the project root
   *  `deno.json#version`. */
  version?: string
}

export type ViewStateBundle = {
  page: 'bundle'
  projectName: string
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
  projectName: string | undefined
  generators: string[] | undefined
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
  | ViewStateProject
  | ViewStateGenerate
  | ViewStatePublish
  | ViewStateBundle
  | ViewStateListGenerators
  | ViewStateAddGenerator
  | ViewStateInstallGenerator
  | ViewStateCloneGenerator
  | ViewStateRemoveGenerator
  | ViewStateExit

export type AppMessage = {
  content: SkmtcMessage
}

export type SkmtcState = {
  view: ViewState
  skmtcRoot: SkmtcRoot
  message: AppMessage | null
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
  switch (action.type) {
    case 'set-view': {
      return { ...state, view: action.payload }
    }
    case 'set-message': {
      return { ...state, message: action.payload }
    }
    case 'add-shortcut': {
      return {
        ...state,
        shortcuts: [...state.shortcuts, action.payload]
      }
    }
    case 'remove-shortcut': {
      return {
        ...state,
        shortcuts: state.shortcuts.filter(shortcut => shortcut.id !== action.payload)
      }
    }
  }
}

const SkmtcProvider = ({ initialState, children, exit }: SkmtcProviderProps) => {
  const [state, dispatch] = useReducer(skmtcReducer, initialState)

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
    dispatch({ type: 'set-message', payload: { content: payload } })
  }

  return { state, dispatch, dispatchMessage, exit }
}

export { SkmtcProvider, useSkmtc }

type ToProjectNameArgs = {
  view: ViewState
}

export const toProjectName = ({ view }: ToProjectNameArgs) => {
  switch (view.page) {
    case 'create-generator':
    case 'create-project':
    case 'project':
    case 'publish':
    case 'bundle':
    case 'list-generators':
    case 'install-generator':
    case 'clone-generator':
    case 'remove-generator': {
      return view.projectName
    }
    case 'generate': {
      return view.project.name
    }
    default: {
      return undefined
    }
  }
}

export const useProjectName = () => {
  const { state } = useSkmtc()

  return toProjectName({ view: state.view })
}
