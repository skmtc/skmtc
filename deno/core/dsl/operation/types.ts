import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { z } from 'zod'
import type { SchemaItem } from '../../types/SchemaItem.ts'

export type OperationInsertableArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

export type TransformOperationArgs<Acc> = {
  context: GenerateContext
  operation: OasOperation
  acc: Acc | undefined
}

export type WithTransformOperation = {
  transformOperation: (operation: OasOperation) => void
}

export type IsSupportedOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  operation: OasOperation
  enrichments: EnrichmentType
}

export type IsSupportedOperationArgs = {
  context: GenerateContext
  operation: OasOperation
}

type ToEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContext
}

export type OperationInsertable<V, EnrichmentType> = { prototype: V } & {
  new ({ context, settings, operation }: OperationInsertableArgs<EnrichmentType>): V
  id: string
  type: 'operation'
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  toEnrichments: ({ operation, context }: ToEnrichmentsArgs) => EnrichmentType
  // deno-lint-ignore ban-types
} & Function

export type IsSupportedArgs = {
  context: GenerateContext
  operation: OasOperation
}

export type OperationConfig<EnrichmentType = undefined> = {
  id: string
  type: 'operation'
  transform: <Acc = void>({ context, operation, acc }: TransformOperationArgs<Acc>) => Acc
  toEnrichmentSchema: () => z.ZodType<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedArgs) => boolean
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toSchemaItem?: (operation: OasOperation) => SchemaItem
}
