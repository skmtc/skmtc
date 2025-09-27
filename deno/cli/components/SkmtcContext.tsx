import { createContext, type ReactNode, useContext, useReducer } from 'react'
import { match } from 'ts-pattern'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { Session } from '@supabase/supabase-js'

type SkmtcAction =
  | { type: 'set-view'; payload: ViewState }
  | {
      type: 'set-session'
      payload: {
        session: Session | null
      }
    }

type SkmtcDispatch = (action: SkmtcAction) => void

type ViewState =
  | {
      page: 'home'
    }
  | {
      page: 'create-project'
    }
  | {
      page: 'login'
    }
  | {
      page: 'project'
      projectName: string
    }
type State = {
  view: ViewState
  skmtcRoot: SkmtcRoot
  session: Session | null
}
type SkmtcProviderProps = {
  skmtcRoot: SkmtcRoot
  children: ReactNode
  session: Session | null
}

const SkmtcStateContext = createContext<{ state: State; dispatch: SkmtcDispatch } | undefined>(
  undefined
)

const skmtcReducer = (state: State, action: SkmtcAction) => {
  return match(action)
    .with({ type: 'set-view' }, ({ payload }) => ({ ...state, view: payload }))
    .with({ type: 'set-session' }, ({ payload }) => ({ ...state, session: payload.session }))

    .exhaustive()
}

const SkmtcProvider = ({ children, skmtcRoot, session }: SkmtcProviderProps) => {
  const [state, dispatch] = useReducer(skmtcReducer, {
    view: { page: 'home' },
    skmtcRoot,
    session
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
