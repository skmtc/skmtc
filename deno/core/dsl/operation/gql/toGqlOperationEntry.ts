import type * as v from 'valibot'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type {
  IsSupportedGqlOperationArgs,
  ToGqlOperationPreviewModuleArgs,
  ToGqlOperationMappingArgs,
  TransformGqlOperationArgs
} from './types.ts'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'

/**
 * Configuration arguments for creating GraphQL operation generator entries.
 *
 * Defines the structure for operation generator configuration including transform
 * functions, enrichment schemas, preview/mapping modules, and support validation.
 *
 * @template EnrichmentType - Type of enrichment data this operation can provide
 */
export type ToGqlOperationConfigArgs<EnrichmentType = undefined> = {
  id: string
  transform: ({ context, operation, variant }: TransformGqlOperationArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported?: (args: IsSupportedGqlOperationArgs) => boolean
  /**
   * Optional: whether this generator entry supports variants. Defaults to a
   * function returning `false` when omitted.
   */
  supportsVariant?: () => boolean
  toPreviewModule?: ({ context, operation }: ToGqlOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToGqlOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: GqlOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}

export type GqlOperationEntry<EnrichmentType = undefined> = {
  id: string
  type: 'gqlOperation'
  transform: ({ context, operation, variant }: TransformGqlOperationArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported: (args: IsSupportedGqlOperationArgs) => boolean
  supportsVariant: () => boolean
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
 * @param config - Configuration object defining operation behavior
 * @returns Configured operation generator entry ready for pipeline integration
 */
export const toGqlOperationEntry = <EnrichmentType = undefined>({
  id,
  transform,
  toEnrichmentSchema,
  isSupported,
  supportsVariant,
  toPreviewModule,
  toMappingModule,
  toEnrichmentRequest
}: ToGqlOperationConfigArgs<EnrichmentType>): GqlOperationEntry<EnrichmentType> => {
  return {
    id,
    type: 'gqlOperation',
    transform,
    toEnrichmentSchema,
    isSupported: isSupported ?? (() => true),
    supportsVariant: supportsVariant ?? (() => false),
    toPreviewModule,
    toMappingModule,
    toEnrichmentRequest
  }
}
