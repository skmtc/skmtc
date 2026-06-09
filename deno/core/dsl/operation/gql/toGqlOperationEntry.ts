import * as v from 'valibot'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type {
  IsSupportedGqlOperationArgs,
  ToGqlOperationPreviewModuleArgs,
  ToGqlOperationMappingArgs,
  TransformGqlOperationArgs,
  IsSupportedGqlOperationConfigArgs
} from './types.ts'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'
import type { Lang } from '@/dsl/Lang.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'
/**
 * Configuration arguments for creating GraphQL operation generator entries.
 *
 * Defines the structure for operation generator configuration including transform
 * functions, enrichment schemas, preview/mapping modules, and support validation.
 *
 * @template EnrichmentType - Type of enrichment data this operation can provide
 * @template Acc - Accumulator type used during operation processing
 */
export type ToGqlOperationConfigArgs<EnrichmentType = undefined, Acc = void> = {
  id: string
  /**
   * The target language for this generator. Rides in the generator
   * config map so the engine can resolve it by `id` via
   * `context.resolveLang(id)` — it is never threaded through calls.
   */
  lang: Lang
  transform: ({ context, operation, acc }: TransformGqlOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported?: ({
    context,
    operation
  }: IsSupportedGqlOperationConfigArgs<EnrichmentType>) => boolean
  toPreviewModule?: ({ context, operation }: ToGqlOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToGqlOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: GqlOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}

/**
 * Creates a configured GraphQL operation generator entry.
 *
 * Transforms operation configuration arguments into a standardized operation generator
 * entry that can be used within the SKMTC generation pipeline. Provides type-safe
 * GraphQL-operation processing with optional enrichment support and preview capabilities.
 *
 * @template EnrichmentType - Type of enrichment data this operation provides
 * @template Acc - Accumulator type used during operation processing
 * @param config - Configuration object defining operation behavior
 * @returns Configured operation generator entry ready for pipeline integration
 */
export const toGqlOperationEntry = <EnrichmentType = undefined, Acc = void>({
  id,
  lang,
  transform,
  toEnrichmentSchema,
  isSupported,
  toPreviewModule,
  toMappingModule,
  toEnrichmentRequest
}: ToGqlOperationConfigArgs<EnrichmentType, Acc>): {
  id: string
  type: 'gqlOperation'
  lang: Lang
  transform: ({ context, operation, acc }: TransformGqlOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedGqlOperationArgs) => boolean
  toPreviewModule?: ({ context, operation }: ToGqlOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToGqlOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: GqlOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
} => {
  return {
    id,
    lang,
    type: 'gqlOperation',
    transform,
    toEnrichmentSchema,
    isSupported: ({ context, operation, variant }: IsSupportedGqlOperationArgs) => {
      if (!isSupported) {
        return true
      }

      // Variant-scoped enrichment lookup — see the OAS-side shim for
      // the rationale.
      const operationEnrichments = get(
        context.settings,
        `enrichments.${id}.${operation.rootKind}.${operation.fieldName}.${variant}`
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
