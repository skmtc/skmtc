import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { z } from 'zod'

export type OperationInsertableArgs<EnrichmentType> = {
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

export type IsSupportedOperationConfigArgs<EnrichmentType> = {
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
  transform: <Acc>({ context, operation, acc }: TransformOperationArgs<Acc>) => Acc

  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichmentSchema: () => z.ZodType<EnrichmentType>
  toEnrichments: ({ operation, context }: ToEnrichmentsArgs) => EnrichmentType
  isSupported: ({ operation, context }: IsSupportedOperationArgs) => boolean
  // deno-lint-ignore ban-types
} & Function
