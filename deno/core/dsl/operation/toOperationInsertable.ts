import { toOperationGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import { OperationBase } from './OperationBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { OperationInsertableArgs } from './types.ts'
import * as v from 'valibot'

export type BaseOperationConfig<EnrichmentType = undefined> = {
  id: string
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
}

type ToEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContext
}

export const toOperationInsertable = <EnrichmentType = undefined>(
  config: BaseOperationConfig<EnrichmentType>
) => {
  const OperationInsertable = class extends OperationBase<EnrichmentType> {
    static id = config.id
    static type = 'operation' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static toEnrichments = ({ operation, context }: ToEnrichmentsArgs): EnrichmentType => {
      const generatorSettings = context.toOperationSettings({
        generatorId: config.id,
        path: operation.path,
        method: operation.method
      })

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, generatorSettings.enrichments) as EnrichmentType
    }

    constructor(args: OperationInsertableArgs<EnrichmentType>) {
      super({
        ...args,
        generatorKey: toOperationGeneratorKey({
          generatorId: config.id,
          operation: args.operation
        })
      })
    }
  }

  return OperationInsertable
}
