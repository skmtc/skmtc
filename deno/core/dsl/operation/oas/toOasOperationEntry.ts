import * as v from 'valibot'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type {
  IsSupportedOasOperationArgs,
  ToOasOperationPreviewModuleArgs,
  ToOasOperationMappingArgs,
  TransformOasOperationArgs
} from '@/dsl/operation/oas/types.ts'
import type { IsSupportedOasOperationConfigArgs } from '@/dsl/operation/oas/types.ts'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'
/**
 * Configuration arguments for creating operation generator entries.
 *
 * Defines the structure for operation generator configuration including transform functions,
 * enrichment schemas, preview/mapping modules, and support validation.
 *
 * @template EnrichmentType - Type of enrichment data this operation can provide
 */
export type ToOasOperationConfigArgs<EnrichmentType = undefined> = {
  id: string
  transform: ({ context, operation, variant }: TransformOasOperationArgs) => void
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported?: ({
    context,
    operation
  }: IsSupportedOasOperationConfigArgs<EnrichmentType>) => boolean
  toPreviewModule?: ({ context, operation }: ToOasOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToOasOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}

/**
 * Creates a configured operation generator entry.
 *
 * Transforms operation configuration arguments into a standardized operation generator entry
 * that can be used within the SKMTC generation pipeline. Provides type-safe operation processing
 * with optional enrichment support and preview capabilities.
 *
 * @template EnrichmentType - Type of enrichment data this operation provides
 * @param config - Configuration object defining operation behavior
 * @returns Configured operation generator entry ready for pipeline integration
 *
 * @example Basic operation entry
 * ```typescript
 * import { toOperationEntry } from '@skmtc/core';
 *
 * const operationEntry = toOperationEntry({
 *   id: 'my-operation-generator',
 *   transform: ({ context, operation }) => {
 *     context.insertOperation({ projection: MyOperation, operation });
 *   },
 *   isSupported: ({ operation }) => {
 *     return operation.method === 'POST';
 *   }
 * });
 * ```
 */
export const toOasOperationEntry = <EnrichmentType = undefined>({
  id,
  transform,
  toEnrichmentSchema,
  isSupported,
  toPreviewModule,
  toMappingModule,
  toEnrichmentRequest
}: ToOasOperationConfigArgs<EnrichmentType>): {
  id: string
  type: 'oasOperation'
  transform: ({ context, operation, variant }: TransformOasOperationArgs) => void
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedOasOperationArgs) => boolean
  toPreviewModule?: ({ context, operation }: ToOasOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToOasOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
} => {
  return {
    id,
    type: 'oasOperation',
    transform,
    toEnrichmentSchema,
    isSupported: ({ context, operation, variant }: IsSupportedOasOperationArgs) => {
      if (!isSupported) {
        return true
      }

      // Variant-scoped enrichment lookup — mirrors
      // `OasOperationProjectionBase.toEnrichments` so the shim and the
      // projection-base resolve to the same inner value.
      const operationEnrichments = get(
        context.settings,
        `enrichments.${id}.${operation.path}.${operation.method}.${variant}`
      )

      const enrichmentSchema = toEnrichmentSchema?.() ?? v.undefined()

      return isSupported({
        context,
        operation,
        enrichments: v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType,
        variant
      })
    },
    toPreviewModule,
    toMappingModule,
    toEnrichmentRequest
  }
}
