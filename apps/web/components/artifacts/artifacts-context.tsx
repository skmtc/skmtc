'use client'

import { RawCode } from 'codehike/code'
import { createContext, ReactNode, useContext, useReducer } from 'react'
import { match } from 'ts-pattern'
import { ManifestContent } from '@skmtc/core/Manifest'

type Action =
  | {
      type: 'set-artifacts'
      payload: Record<string, string>
    }
  | {
      type: 'set-selected-artifact'
      payload: RawCode
    }
  | {
      type: 'set-manifest'
      payload: ManifestContent
    }

type Dispatch = (action: Action) => void

type State = {
  artifacts: Record<string, string>
  selectedArtifact: RawCode
  manifest: ManifestContent | undefined
}

type ArtifactsProviderProps = {
  children: ReactNode
}

const ArtifactsStateContext = createContext<{ state: State; dispatch: Dispatch } | undefined>(
  undefined
)

const artifactsReducer = (state: State, action: Action) => {
  return match(action)
    .with({ type: 'set-artifacts' }, ({ payload }) => {
      console.log('SET ARTIFACTS', payload)
      return {
        ...state,
        artifacts: payload
      }
    })
    .with({ type: 'set-selected-artifact' }, ({ payload }) => {
      console.log('SET SELECTED ARTIFACT', payload)
      return {
        ...state,
        selectedArtifact: payload
      }
    })
    .with({ type: 'set-manifest' }, ({ payload }) => {
      console.log('SET MANIFEST', payload)
      return {
        ...state,
        manifest: payload
      }
    })
    .exhaustive()
}

const ArtifactsProvider = ({ children }: ArtifactsProviderProps) => {
  const [state, dispatch] = useReducer(artifactsReducer, {
    artifacts: {},
    selectedArtifact: { value: '', lang: 'js', meta: '' },
    manifest: undefined
  })
  // NOTE: you *might* need to memoize this value
  // Learn more in http://kcd.im/optimize-context
  const value = { state, dispatch }

  return <ArtifactsStateContext.Provider value={value}>{children}</ArtifactsStateContext.Provider>
}

const useArtifacts = () => {
  const context = useContext(ArtifactsStateContext)

  if (context === undefined) {
    throw new Error('useArtifacts must be used within a ArtifactsProvider')
  }

  return context
}

export { ArtifactsProvider, useArtifacts }
