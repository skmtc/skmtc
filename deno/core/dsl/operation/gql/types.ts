import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'

/**
 * External constructor signature for a GraphQL operation projection class.
 *
 * The pipeline calls `new SomeProjection(args)` with this shape; the
 * runtime base class injects `generatorKey` before calling `super()`.
 */
export type GqlOperationProjectionConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  operation: GqlOperation
}

export type TransformGqlOperationArgs<Acc> = {
  context: GenerateContextType
  operation: GqlOperation
  acc: Acc | undefined
}

export type WithTransformGqlOperation = {
  transformOperation: (operation: GqlOperation) => void
}

export type IsSupportedGqlOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  operation: GqlOperation
  enrichments: EnrichmentType
}

export type IsSupportedGqlOperationArgs = {
  context: GenerateContextType
  operation: GqlOperation
}

export type ToGqlOperationEnrichmentsArgs = {
  operation: GqlOperation
  context: GenerateContextType
}

export type ToGqlOperationPreviewModuleArgs = {
  context: GenerateContextType
  operation: GqlOperation
}

export type ToGqlOperationMappingArgs = {
  context: GenerateContextType
  operation: GqlOperation
}

/**
 * Static structural type of a GraphQL operation projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifier`, `toExportPath`, `toEnrichments`). Passed as a
 * type parameter to `context.insertOperation(...)`.
 */
export type ToGqlOperationIdentifierArgs<EnrichmentType = undefined> = {
  operation: GqlOperation
  enrichments: EnrichmentType
}

export type ToGqlOperationExportPathArgs<EnrichmentType = undefined> = {
  operation: GqlOperation
  enrichments: EnrichmentType
}

export type GqlOperationProjection<V, EnrichmentType = undefined> = { prototype: V } & {
  new ({
    context,
    settings,
    operation
  }: GqlOperationProjectionConstructorArgs<EnrichmentType>): V
  id: string
  type: 'gqlOperation'
  toIdentifier: (args: ToGqlOperationIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToGqlOperationExportPathArgs<EnrichmentType>) => string
  toEnrichments: ({ operation, context }: ToGqlOperationEnrichmentsArgs) => EnrichmentType
  // deno-lint-ignore ban-types
} & Function

/**
 * Pipeline-side configuration for a GraphQL operation projection (built by
 * `toGqlOperationEntry`).
 */
export type GqlOperationConfig<EnrichmentType = undefined> = {
  id: string
  type: 'gqlOperation'
  transform: <Acc = void>({ context, operation, acc }: TransformGqlOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedGqlOperationArgs) => boolean
  toPreviewModule?: ({ context, operation }: ToGqlOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToGqlOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: GqlOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
