import { match } from 'ts-pattern'
import type {
  Method,
  OasDocument,
  OperationGateway,
  ClientSettings,
  ClientGeneratorSettings,
  OperationInsertable,
  GeneratedValue,
  ModelInsertable
} from '@skmtc/core'

type GeneratorsType = (
  | OperationGateway
  | OperationInsertable<GeneratedValue>
  | ModelInsertable<GeneratedValue>
)[]

type ToSettingsArgs = {
  generators: GeneratorsType
  clientSettings: ClientSettings | undefined
  defaultSelected: boolean
  oasDocument: OasDocument
}

export const toSettings = ({
  generators,
  clientSettings,
  defaultSelected,
  oasDocument
}: ToSettingsArgs) => {
  const generatorsSettings: ClientGeneratorSettings[] = generators.map(generator => {
    const generatorSettings = clientSettings?.generators.find(({ id }) => id === generator.id)

    const generatorType = generator.type

    return match(generatorType)
      .with('operation', () => {
        if (!generatorSettings) {
          return {
            id: generator.id,
            operations: toOperations({
              generator: generator as OperationGateway,
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
            generator: generator as OperationGateway,
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
  modelsSettings: Record<string, boolean> | undefined
}

const toModels = ({ defaultSelected, oasDocument, modelsSettings }: ToModelsArgs) => {
  return Object.fromEntries(
    Object.keys(oasDocument.components?.schemas ?? {}).map(refName => [
      refName,
      modelsSettings?.[refName] ? modelsSettings?.[refName] : defaultSelected
    ])
  )
}

type ToOperationsArgs = {
  generator: OperationGateway
  oasDocument: OasDocument
  defaultSelected: boolean
  operationsSettings: Record<string, Partial<Record<Method, boolean>>> | undefined
}

type OperationSettings = Record<string, Record<Method, boolean>>

const toOperations = ({
  generator,
  oasDocument,
  operationsSettings,
  defaultSelected
}: ToOperationsArgs) => {
  return Object.values(oasDocument.operations)
    .filter(operation => generator.isSupported(operation))
    .reduce<OperationSettings>((acc, operation) => {
      const { path, method } = operation

      acc[path] = acc[path] ?? {}

      acc[path][method] = operationsSettings?.[path]?.[method]
        ? operationsSettings?.[path]?.[method]
        : defaultSelected

      return acc
    }, {})
}
