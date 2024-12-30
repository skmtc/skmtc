import { match } from 'ts-pattern'
import type { Method } from '../types/Method.js'
import type { OasDocument } from '../oas/document/Document.js'
import type { ClientSettings, ClientGeneratorSettings, EnrichedSetting } from '../types/Settings.js'
import type { OperationGateway } from '../dsl/operation/OperationInsertable.js'
import type { GeneratorType } from '../types/GeneratorType.js'

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
        if (!generatorSettings) {
          return {
            id: generator.id,
            operations: toOperations({
              generator: generator as OperationGateway<EnrichmentType>,
              oasDocument,
              defaultSelected,
              operationsSettings: undefined
            })
          }
        }

        return {
          ...generatorSettings,
          id: generator.id,
          operations: toOperations({
            generator: generator as OperationGateway<EnrichmentType>,
            oasDocument,
            defaultSelected,
            operationsSettings:
              'operations' in generatorSettings ? generatorSettings.operations : undefined
          })
        }
      })
      .with('model', () => {
        if (!generatorSettings) {
          return {
            id: generator.id,
            models: toModels({
              oasDocument,
              defaultSelected,
              modelsSettings: undefined
            })
          }
        }

        return {
          ...generatorSettings,
          id: generator.id,
          models: toModels({
            oasDocument,
            defaultSelected,
            modelsSettings: 'models' in generatorSettings ? generatorSettings.models : undefined
          })
        }
      })
      .otherwise(matched => {
        throw new Error(`Invalid generator type: '${matched}' for ${generator.id}`)
      })
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

type ToOperationsArgs<EnrichmentType> = {
  generator: OperationGateway<EnrichmentType>
  oasDocument: OasDocument
  defaultSelected: boolean
  operationsSettings: Record<string, Partial<Record<Method, EnrichedSetting>>> | undefined
}

type OperationSettings = Record<string, Record<Method, EnrichedSetting>>

const toOperations = <EnrichmentType>({
  oasDocument,
  operationsSettings,
  defaultSelected
}: ToOperationsArgs<EnrichmentType>) => {
  return Object.values(oasDocument.operations).reduce<OperationSettings>((acc, operation) => {
    const { path, method } = operation

    acc[path] = acc[path] ?? {}

    acc[path][method] = operationsSettings?.[path]?.[method]
      ? operationsSettings?.[path]?.[method]
      : ({ selected: defaultSelected, enrichments: undefined } as EnrichedSetting)

    return acc
  }, {})
}
