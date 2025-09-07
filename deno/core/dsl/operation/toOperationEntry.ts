import * as v from 'valibot'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type {
  IsSupportedArgs,
  ToOperationPreviewModuleArgs,
  ToOperationMappingArgs,
  TransformOperationArgs
} from './types.ts'
import type { IsSupportedOperationConfigArgs } from './types.ts'
import type { MappingModule, PreviewModule } from '../../types/Preview.ts'
// @deno-types="npm:@types/lodash-es@4.17.12"
import { get } from 'npm:lodash-es@4.17.21'
/**
 * Configuration arguments for creating operation generator entries.
 * 
 * Defines the structure for operation generator configuration including transform functions,
 * enrichment schemas, preview/mapping modules, and support validation.
 * 
 * @template EnrichmentType - Type of enrichment data this operation can provide
 * @template Acc - Accumulator type used during operation processing
 */
export type ToOperationConfigArgs<EnrichmentType = undefined, Acc = void> = {
  id: string
  transform: ({ context, operation, acc }: TransformOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported?: ({ context, operation }: IsSupportedOperationConfigArgs<EnrichmentType>) => boolean
  toPreviewModule?: ({ context, operation }: ToOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToOperationMappingArgs) => MappingModule
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
 * @template Acc - Accumulator type used during operation processing
 * @param config - Configuration object defining operation behavior
 * @returns Configured operation generator entry ready for pipeline integration
 * 
 * @example Basic operation entry
 * ```typescript
 * import { toOperationEntry } from '@skmtc/core';
 * 
 * const operationEntry = toOperationEntry({
 *   id: 'my-operation-generator',
 *   transform: ({ context, operation, acc }) => {
 *     // Transform operation into desired format
 *     return processedOperation;
 *   },
 *   isSupported: ({ operation }) => {
 *     return operation.method === 'POST';
 *   }
 * });
 * ```
 */
export const toOperationEntry = <EnrichmentType = undefined, Acc = void>({
  id,
  transform,
  toEnrichmentSchema,
  isSupported,
  toPreviewModule,
  toMappingModule,
  toEnrichmentRequest
}: ToOperationConfigArgs<EnrichmentType, Acc>): {
  id: string;
  type: 'operation';
  transform: ({ context, operation, acc }: TransformOperationArgs<Acc>) => Acc;
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>;
  isSupported: ({ context, operation }: IsSupportedArgs) => boolean;
  toPreviewModule?: ({ context, operation }: ToOperationPreviewModuleArgs) => PreviewModule;
  toMappingModule?: ({ context, operation }: ToOperationMappingArgs) => MappingModule;
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined;
} => {
  return {
    id,
    type: 'operation',
    transform,
    toEnrichmentSchema,
    isSupported: ({ context, operation }: IsSupportedArgs) => {
      if (!isSupported) {
        return true
      }

      const operationEnrichments = get(
        context.settings,
        `enrichments.${id}.${operation.path}.${operation.method}`
      )

      const enrichmentSchema = toEnrichmentSchema?.() ?? v.undefined()

      return isSupported({
        context,
        operation,
        enrichments: v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
      })
    },
    toPreviewModule,
    toMappingModule,
    toEnrichmentRequest
  }
}
