import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'
/**
 * Arguments passed to GraphQL operation insertable constructors.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type GqlOperationInsertableArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  operation: GqlOperation
}

/**
 * Arguments passed to GraphQL operation transformation functions.
 *
 * @template Acc - Accumulator type for collecting transformation results
 */
export type TransformGqlOperationArgs<Acc> = {
  context: GenerateContextType
  operation: GqlOperation
  acc: Acc | undefined
}

/**
 * Interface for objects that provide GraphQL operation transformation capabilities.
 *
 * Used by generator configurations to transform operation definitions
 * during the code generation process.
 */
export type WithTransformGqlOperation = {
  transformOperation: (operation: GqlOperation) => void
}

/**
 * Arguments for checking if a GraphQL operation is supported with enrichment configuration.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type IsSupportedGqlOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  operation: GqlOperation
  enrichments: EnrichmentType
}

/**
 * Arguments for checking if a GraphQL operation is supported for code generation.
 */
export type IsSupportedGqlOperationArgs = {
  context: GenerateContextType
  operation: GqlOperation
}

/**
 * Arguments for generating enrichment data for GraphQL operations.
 */
export type ToGqlOperationEnrichmentsArgs = {
  operation: GqlOperation
  context: GenerateContextType
}

/**
 * Arguments for generating GraphQL operation preview modules.
 *
 * Preview modules provide quick insights into generated operations
 * without full code generation.
 */
export type ToGqlOperationPreviewModuleArgs = {
  context: GenerateContextType
  operation: GqlOperation
}

/**
 * Arguments for generating GraphQL operation mapping information.
 *
 * Mappings track relationships between GraphQL operations and generated code,
 * enabling cross-references and dependency analysis.
 */
export type ToGqlOperationMappingArgs = {
  context: GenerateContextType
  operation: GqlOperation
}

/**
 * Configuration object for insertable GraphQL operation generators.
 *
 * Defines the contract for operation generator classes that can be inserted
 * into the generation context to produce type-safe operation definitions.
 *
 * @template V - Generated value type produced by the operation generator
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type GqlOperationInsertable<V, EnrichmentType = undefined> = { prototype: V } & {
  new ({ context, settings, operation }: GqlOperationInsertableArgs<EnrichmentType>): V
  id: string
  type: 'operation'
  toIdentifier: (operation: GqlOperation) => Identifier
  toExportPath: (operation: GqlOperation) => string
  toEnrichments: ({ operation, context }: ToGqlOperationEnrichmentsArgs) => EnrichmentType
  // deno-lint-ignore ban-types
} & Function

/**
 * Arguments for checking if a GraphQL operation is supported for generation.
 */
export type IsSupportedArgs = {
  context: GenerateContextType
  operation: GqlOperation
}

/**
 * Configuration object for GraphQL operation generators.
 *
 * Defines the behavior and capabilities of operation generators including
 * support detection, transformation logic, and enrichment handling.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type GqlOperationConfig<EnrichmentType = undefined> = {
  id: string
  type: 'gqlOperation'
  transform: <Acc = void>({ context, operation, acc }: TransformGqlOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedArgs) => boolean
  toPreviewModule?: ({ context, operation }: ToGqlOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToGqlOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: GqlOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
