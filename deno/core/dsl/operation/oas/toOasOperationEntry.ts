import type * as v from 'valibot'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type {
  IsSupportedOasOperationArgs,
  ToOasOperationPreviewModuleArgs,
  ToOasOperationMappingArgs,
  ToOasOperationEnrichmentsArgs,
  TransformOasOperationArgs
} from '@/dsl/operation/oas/types.ts'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'

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
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported?: (args: IsSupportedOasOperationArgs) => boolean
  /**
   * Optional: whether this generator entry supports variants. Defaults to a
   * function returning `false` when omitted.
   */
  supportsVariant?: () => boolean
  toPreviewModule?: ({ context, operation }: ToOasOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToOasOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  /**
   * Optional: compute the DEFAULT enrichment values for an operation from its
   * schema — the seed the CMS persists and the user then edits. Typically a
   * thin forward to the projection base's static of the same name
   * (`toEnrichmentDefaults: MyProjection.toEnrichmentDefaults`) so the logic
   * has a single home in `base.ts` while the entry exposes it to the seeding
   * pass (which walks the generator-config map, not projection classes).
   */
  toEnrichmentDefaults?: ({
    operation,
    context,
    variant
  }: ToOasOperationEnrichmentsArgs) => EnrichmentType | undefined
}

export type OasOperationEntry<EnrichmentType = undefined> = {
  id: string
  type: 'oasOperation'
  transform: ({ context, operation, variant }: TransformOasOperationArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported: (args: IsSupportedOasOperationArgs) => boolean
  supportsVariant: () => boolean
  toPreviewModule?: ({ context, operation }: ToOasOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToOasOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichmentDefaults?: ({
    operation,
    context,
    variant
  }: ToOasOperationEnrichmentsArgs) => EnrichmentType | undefined
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
  supportsVariant,
  toPreviewModule,
  toMappingModule,
  toEnrichmentRequest,
  toEnrichmentDefaults
}: ToOasOperationConfigArgs<EnrichmentType>): OasOperationEntry<EnrichmentType> => {
  return {
    id,
    type: 'oasOperation',
    transform,
    toEnrichmentSchema,
    isSupported: isSupported ?? (() => true),
    supportsVariant: supportsVariant ?? (() => false),
    toPreviewModule,
    toMappingModule,
    toEnrichmentRequest,
    toEnrichmentDefaults
  }
}
