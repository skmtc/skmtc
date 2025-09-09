import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '../../types/Preview.ts'
/**
 * Arguments passed to operation insertable constructors.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type OperationInsertableArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

/**
 * Arguments passed to operation transformation functions.
 *
 * @template Acc - Accumulator type for collecting transformation results
 */
export type TransformOperationArgs<Acc> = {
  context: GenerateContext
  operation: OasOperation
  acc: Acc | undefined
}

/**
 * Interface for objects that provide operation transformation capabilities.
 *
 * Used by generator configurations to transform operation definitions
 * during the code generation process.
 */
export type WithTransformOperation = {
  transformOperation: (operation: OasOperation) => void
}

/**
 * Arguments for checking if an operation is supported with enrichment configuration.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type IsSupportedOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  operation: OasOperation
  enrichments: EnrichmentType
}

/**
 * Arguments for checking if an operation is supported for code generation.
 */
export type IsSupportedOperationArgs = {
  context: GenerateContext
  operation: OasOperation
}

/**
 * Arguments for generating enrichment data for operations.
 */
export type ToOperationEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContext
}

/**
 * Arguments for generating operation preview modules.
 *
 * Preview modules provide quick insights into generated operations
 * without full code generation.
 */
export type ToOperationPreviewModuleArgs = {
  context: GenerateContext
  operation: OasOperation
}

/**
 * Arguments for generating operation mapping information.
 *
 * Mappings track relationships between OAS operations and generated code,
 * enabling cross-references and dependency analysis.
 */
export type ToOperationMappingArgs = {
  context: GenerateContext
  operation: OasOperation
}

/**
 * Configuration object for insertable operation generators.
 *
 * Defines the contract for operation generator classes that can be inserted
 * into the generation context to produce type-safe operation definitions.
 *
 * @template V - Generated value type produced by the operation generator
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type OperationInsertable<V, EnrichmentType = undefined> = { prototype: V } & {
  new ({ context, settings, operation }: OperationInsertableArgs<EnrichmentType>): V
  id: string
  type: 'operation'
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  toEnrichments: ({ operation, context }: ToOperationEnrichmentsArgs) => EnrichmentType
  // deno-lint-ignore ban-types
} & Function

/**
 * Arguments for checking if an operation is supported for generation.
 */
export type IsSupportedArgs = {
  context: GenerateContext
  operation: OasOperation
}

/**
 * Configuration object for operation generators.
 *
 * Defines the behavior and capabilities of operation generators including
 * support detection, transformation logic, and enrichment handling.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type OperationConfig<EnrichmentType = undefined> = {
  id: string
  type: 'operation'
  transform: <Acc = void>({ context, operation, acc }: TransformOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedArgs) => boolean
  toPreviewModule?: ({ context, operation }: ToOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
