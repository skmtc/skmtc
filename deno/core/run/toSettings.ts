import { match } from 'ts-pattern'
import type { Method } from '../types/Method.ts'
import type { OasDocument } from '../oas/document/Document.ts'
import type { ClientSettings, ClientGeneratorSettings, EnrichedSetting } from '../types/Settings.ts'
import type { GeneratorType } from '../types/GeneratorType.ts'

type ToSettingsArgs<EnrichmentType> = {
  generators: GeneratorType<EnrichmentType>[]
  clientSettings: ClientSettings | undefined
  defaultSelected: boolean
  oasDocument: OasDocument
}

export const toSettings = <EnrichmentType>({
  generators,
  clientSettings,
  defaultSelected,
  oasDocument
}: ToSettingsArgs<EnrichmentType>) => {
  const generatorsSettings: ClientGeneratorSettings[] = generators.map(generator => {
    const generatorSettings = clientSettings?.generators.find(({ id }) => id === generator.id)

    const generatorType = generator.type

    return match(generatorType)
      .with('operation', () => {
        return {
          ...generatorSettings,
          id: generator.id,
          operations: toOperations({
            oasDocument,
            defaultSelected,
            operationsSettings:
              generatorSettings && 'operations' in generatorSettings
                ? generatorSettings.operations
                : undefined
          })
        }
      })
      .with('model', () => {
        return {
          ...generatorSettings,
          id: generator.id,
          models: toModels({
            oasDocument,
            defaultSelected,
            modelsSettings:
              generatorSettings && 'models' in generatorSettings
                ? generatorSettings.models
                : undefined
          })
        }
      })
      .exhaustive()
  })

  return generatorsSettings
}

type ToModelsArgs = {
  defaultSelected: boolean
  oasDocument: OasDocument
  modelsSettings: Record<string, EnrichedSetting> | undefined
}

const toModels = ({ defaultSelected, oasDocument, modelsSettings }: ToModelsArgs) => {
  return Object.fromEntries(
    Object.keys(oasDocument.components?.schemas ?? {}).map(refName => [
      refName,
      modelsSettings?.[refName]
        ? modelsSettings?.[refName]
        : ({ selected: defaultSelected, enrichments: undefined } as EnrichedSetting)
    ])
  )
}

type ToOperationsArgs = {
  oasDocument: OasDocument
  defaultSelected: boolean
  operationsSettings: Record<string, Partial<Record<Method, EnrichedSetting>>> | undefined
}

type OperationSettings = Record<string, Record<Method, EnrichedSetting>>

const toOperations = ({ oasDocument, operationsSettings, defaultSelected }: ToOperationsArgs) => {
  return Object.values(oasDocument.operations).reduce<OperationSettings>((acc, operation) => {
    const { path, method } = operation

    acc[path] = acc[path] ?? {}

    acc[path][method] = operationsSettings?.[path]?.[method]
      ? operationsSettings?.[path]?.[method]
      : ({ selected: defaultSelected, enrichments: undefined } as EnrichedSetting)

    return acc
  }, {})
}
