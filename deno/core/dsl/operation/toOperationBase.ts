import { toOperationGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import { OperationBase } from './OperationBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { OperationInsertableArgs } from './types.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12"
import { get } from 'npm:lodash-es@4.17.21'

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

export const toOperationBase = <EnrichmentType = undefined>(
  config: BaseOperationConfig<EnrichmentType>
) => {
  return class extends OperationBase<EnrichmentType> {
    static id = config.id
    static type = 'operation' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static toEnrichments = ({ operation, context }: ToEnrichmentsArgs): EnrichmentType => {
      const operationEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${operation.path}.${operation.method}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
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
}
