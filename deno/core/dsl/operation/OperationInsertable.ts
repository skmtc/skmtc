import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { z } from 'zod'

type OperationInsertableConstructorArgs<EnrichmentType> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

export type WithTransformOperation = {
  transformOperation: (operation: OasOperation) => void
}

export type OperationOperationGatewayArgs<EnrichmentType> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
}

export type IsSupportedOperationArgs<EnrichmentType> = {
  operation: OasOperation
  enrichments: EnrichmentType
  context: GenerateContext
}

type ToEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContext
}

export type OperationGateway<EnrichmentType> = {
  new ({ context, settings }: OperationOperationGatewayArgs<EnrichmentType>): WithTransformOperation
  id: string
  type: 'operation'
  _class: 'OperationGateway'

  toIdentifier: () => Identifier
  toExportPath: () => string
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined
  toResponseSchema: () => z.ZodType<EnrichmentType>
  toEnrichments: ({ operation, context }: ToEnrichmentsArgs) => EnrichmentType
  isSupported: ({
    operation,
    enrichments,
    context
  }: IsSupportedOperationArgs<EnrichmentType>) => boolean

  pinnable: boolean
}

export type OperationInsertable<V, EnrichmentType> = { prototype: V } & {
  new ({ context, settings, operation }: OperationInsertableConstructorArgs<EnrichmentType>): V
  id: string
  type: 'operation'
  _class: 'OperationInsertable'
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined
  toResponseSchema: () => z.ZodType<EnrichmentType>
  toEnrichments: ({ operation, context }: ToEnrichmentsArgs) => EnrichmentType
  isSupported: ({
    operation,
    enrichments,
    context
  }: IsSupportedOperationArgs<EnrichmentType>) => boolean

  pinnable: boolean

  // deno-lint-ignore ban-types
} & Function
