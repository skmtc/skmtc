'use client'

import { RawCode } from 'codehike/code'
import { createContext, Dispatch, ReactNode, useContext, useEffect } from 'react'
import { match } from 'ts-pattern'
import { ManifestContent } from '@skmtc/core/Manifest'
import clientSettingsInitial from './client.json'
import { ClientSettings } from '@skmtc/core/Settings'
import { useThunkReducer } from '@/hooks/use-thunk-reducer'
import { useCreateSettings } from '@/services/use-create-settings'
import { OperationPreview, Preview } from '@skmtc/core/Preview'
import { set, get } from 'lodash'
import {
  FormFieldItem,
  ColumnConfigItem,
  FormSectionItem,
  InputOptionConfigItem
} from '@/components/config/types'
import { useParseSchema } from '@/services/use-parse-schema'
import type { OpenAPIV3 } from 'openapi-types'
export type ArtifactsAction =
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
  | {
      type: 'set-schema'
      payload: string
    }
  | {
      type: 'set-selected-generators'
      payload: Record<string, boolean>
    }
  | {
      type: 'set-client-settings'
      payload: ClientSettings
    }
  | {
      type: 'add-column-config'
      payload: AddColumnConfigPayload
    }
  | {
      type: 'add-form-section'
      payload: AddFormSectionPayload
    }
  | {
      type: 'delete-column-config'
      payload: DeleteColumnConfigPayload
    }
  | {
      type: 'delete-form-section'
      payload: DeleteFormSectionPayload
    }
  | {
      type: 'set-preview'
      payload: Preview
    }
  | {
      type: 'add-form-field'
      payload: AddFormFieldPayload
    }
  | {
      type: 'delete-form-field'
      payload: DeleteFormFieldPayload
    }
  | {
      type: 'set-parsed-schema'
      payload: OpenAPIV3.Document
    }
  | {
      type: 'add-input-option'
      payload: AddInputOptionPayload
    }

type AddColumnConfigPayload = {
  source: OperationPreview
  columnConfig: ColumnConfigItem
}

type DeleteColumnConfigPayload = {
  source: OperationPreview
  index: number
}

type AddFormSectionPayload = {
  source: OperationPreview
  formSection: FormSectionItem
}

type DeleteFormSectionPayload = {
  source: OperationPreview
  sectionIndex: number
}

type AddFormFieldPayload = {
  source: OperationPreview
  sectionIndex: number
  formField: FormFieldItem
}

type DeleteFormFieldPayload = {
  source: OperationPreview
  sectionIndex: number
  fieldIndex: number
}

type AddInputOptionPayload = {
  source: OperationPreview
  inputOption: InputOptionConfigItem
}

export type ArtifactsDispatch = Dispatch<ArtifactsAction>

type OperationEnrichments = {
  columns: ColumnConfigItem[]
  formSections: FormSectionItem[]
  optionLabel: InputOptionConfigItem
}

type MethodEnrichments = Record<string, OperationEnrichments>
type PathEnrichments = Record<string, MethodEnrichments>
export type GeneratorEnrichments = Record<string, PathEnrichments>

export type ArtifactsState = {
  artifacts: Record<string, string>
  selectedArtifact: RawCode
  manifest: ManifestContent | undefined
  clientSettings: ClientSettings
  schema: string
  parsedSchema: OpenAPIV3.Document | null
  selectedGenerators: Record<string, boolean>
  enrichments: GeneratorEnrichments
  preview: Preview | null
  downloadFileTree: Record<string, string>
}

type ArtifactsProviderProps = {
  children: ReactNode
  downloadFileTree: Record<string, string>
}

export const ArtifactsStateContext = createContext<
  | {
      state: ArtifactsState
      dispatch: ArtifactsDispatch
    }
  | undefined
>(undefined)

const artifactsReducer = (state: ArtifactsState, action: ArtifactsAction) => {
  return match(action)
    .with({ type: 'set-artifacts' }, ({ payload }) => ({
      ...state,
      artifacts: payload
    }))
    .with({ type: 'set-selected-artifact' }, ({ payload }) => ({
      ...state,
      selectedArtifact: payload
    }))
    .with({ type: 'set-manifest' }, ({ payload }) => ({
      ...state,
      manifest: payload
    }))
    .with({ type: 'set-schema' }, ({ payload }) => ({
      ...state,
      schema: payload
    }))
    .with({ type: 'set-selected-generators' }, ({ payload }) => ({
      ...state,
      selectedGenerators: payload
    }))
    .with({ type: 'set-client-settings' }, ({ payload }) => ({
      ...state,
      clientSettings: payload
    }))
    .with({ type: 'set-preview' }, ({ payload }) => ({
      ...state,
      preview: payload
    }))
    .with({ type: 'add-column-config' }, ({ payload }) => {
      const { source, columnConfig } = payload
      const { generatorId, operationPath, operationMethod } = source

      const columnsPath = [generatorId, operationPath, operationMethod, 'columns']

      const enrichmentsCopy = structuredClone(state.enrichments)

      const methodEnrichments = get(enrichmentsCopy, columnsPath) ?? []

      return {
        ...state,
        enrichments: set(enrichmentsCopy, columnsPath, methodEnrichments.concat(columnConfig))
      }
    })
    .with({ type: 'delete-column-config' }, ({ payload }) => {
      const { source, index } = payload
      const { generatorId, operationPath, operationMethod } = source
      const columnsPath = [generatorId, operationPath, operationMethod, 'columns']

      const enrichmentsCopy = structuredClone(state.enrichments)

      const methodEnrichments = get(enrichmentsCopy, columnsPath) ?? []

      return {
        ...state,
        enrichments: set(
          enrichmentsCopy,
          columnsPath,
          methodEnrichments.filter((_, i) => i !== index)
        )
      }
    })
    .with({ type: 'add-form-section' }, ({ payload }) => {
      const { source, formSection } = payload
      const { generatorId, operationPath, operationMethod } = source
      const formSectionsPath = [generatorId, operationPath, operationMethod, 'formSections']

      const enrichmentsCopy = structuredClone(state.enrichments)

      const methodEnrichments = get(enrichmentsCopy, formSectionsPath) ?? []

      return {
        ...state,
        enrichments: set(enrichmentsCopy, formSectionsPath, methodEnrichments.concat(formSection))
      }
    })
    .with({ type: 'delete-form-section' }, ({ payload }) => {
      const { source, sectionIndex } = payload
      const { generatorId, operationPath, operationMethod } = source
      const formSectionsPath = [generatorId, operationPath, operationMethod, 'formSections']

      const enrichmentsCopy = structuredClone(state.enrichments)

      const methodEnrichments = get(enrichmentsCopy, formSectionsPath) ?? []

      return {
        ...state,
        enrichments: set(
          enrichmentsCopy,
          formSectionsPath,
          methodEnrichments.filter((_, i) => i !== sectionIndex)
        )
      }
    })
    .with({ type: 'add-input-option' }, ({ payload }) => {
      const { source, inputOption } = payload
      const { generatorId, operationPath, operationMethod } = source
      const inputOptionsPath = [generatorId, operationPath, operationMethod, 'optionLabel']

      const enrichmentsCopy = structuredClone(state.enrichments)

      const methodEnrichments = get(enrichmentsCopy, inputOptionsPath) ?? []

      return {
        ...state,
        enrichments: set(enrichmentsCopy, inputOptionsPath, inputOption)
      }
    })
    .with({ type: 'add-form-field' }, ({ payload }) => {
      const { source, sectionIndex, formField } = payload
      const { generatorId, operationPath, operationMethod } = source
      const formFieldsPath = [
        generatorId,
        operationPath,
        operationMethod,
        'formSections',
        sectionIndex,
        'fields'
      ]

      const enrichmentsCopy = structuredClone(state.enrichments)

      const methodEnrichments = get(enrichmentsCopy, formFieldsPath) ?? []

      return {
        ...state,
        enrichments: set(enrichmentsCopy, formFieldsPath, methodEnrichments.concat(formField))
      }
    })
    .with({ type: 'delete-form-field' }, ({ payload }) => {
      const { source, sectionIndex, fieldIndex } = payload
      const { generatorId, operationPath, operationMethod } = source

      const formFieldsPath = [
        generatorId,
        operationPath,
        operationMethod,
        'formSections',
        sectionIndex,
        'fields'
      ]

      const enrichmentsCopy = structuredClone(state.enrichments)

      const methodEnrichments = get(enrichmentsCopy, formFieldsPath) ?? []

      return {
        ...state,
        enrichments: set(
          enrichmentsCopy,
          formFieldsPath,
          methodEnrichments.filter((_, i) => i !== fieldIndex)
        )
      }
    })
    .with({ type: 'set-parsed-schema' }, ({ payload }) => ({
      ...state,
      parsedSchema: payload
    }))
    .exhaustive()
}

const ArtifactsProvider = ({ children, downloadFileTree }: ArtifactsProviderProps) => {
  const [state, dispatch] = useThunkReducer(artifactsReducer, {
    artifacts: {},
    selectedArtifact: { value: '', lang: 'js', meta: '' },
    manifest: undefined,
    clientSettings: clientSettingsInitial,
    schema: '',
    parsedSchema: null,
    selectedGenerators: {},
    enrichments: {},
    preview: null,
    downloadFileTree
  })

  const createSettingsMutation = useCreateSettings({
    onSuccess: generatorsSettings => {
      dispatch({
        type: 'set-client-settings',
        payload: {
          ...state.clientSettings,
          ...generatorsSettings
        }
      })
    }
  })

  const parseSchemaMutation = useParseSchema({
    onSuccess: parsedSchema => {
      dispatch({
        type: 'set-parsed-schema',
        payload: parsedSchema
      })
    }
  })

  useEffect(() => {
    if (state.schema && createSettingsMutation.isIdle) {
      createSettingsMutation.mutate(state.schema)
    }

    if (state.schema && parseSchemaMutation.isIdle) {
      parseSchemaMutation.mutate(state.schema)
    }
  }, [state.schema])

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
