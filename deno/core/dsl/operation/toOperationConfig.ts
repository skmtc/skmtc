import * as v from 'valibot'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { IsSupportedArgs, TransformOperationArgs } from './types.ts'
import type { IsSupportedOperationConfigArgs } from './types.ts'
import type { SchemaOption } from '../../types/SchemaOptions.ts'
export type ToOperationConfigArgs<EnrichmentType = undefined, Acc = void> = {
  id: string
  transform: ({ context, operation, acc }: TransformOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported?: ({ context, operation }: IsSupportedOperationConfigArgs<EnrichmentType>) => boolean
  toSchemaOptions?: () => SchemaOption[]
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}

export const toOperationConfig = <EnrichmentType = undefined, Acc = void>({
  id,
  transform,
  toEnrichmentSchema,
  isSupported,
  toSchemaOptions,
  toEnrichmentRequest
}: ToOperationConfigArgs<EnrichmentType, Acc>) => {
  return {
    id,
    type: 'operation',
    transform,
    toSchemaOptions,
    toEnrichmentSchema,
    isSupported: ({ context, operation }: IsSupportedArgs) => {
      if (!isSupported) {
        return true
      }

      const { enrichments } = context.toOperationSettings({
        generatorId: id,
        path: operation.path,
        method: operation.method
      })

      const enrichmentSchema = toEnrichmentSchema?.() ?? v.undefined()

      return isSupported({
        context,
        operation,
        enrichments: v.parse(enrichmentSchema, enrichments) as EnrichmentType
      })
    },
    toEnrichmentRequest
  }
}
