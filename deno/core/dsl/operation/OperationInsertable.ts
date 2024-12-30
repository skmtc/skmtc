import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'

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
}

export type OperationGateway<EnrichmentType> = {
  new ({ context, settings }: OperationOperationGatewayArgs<EnrichmentType>): WithTransformOperation
  id: string
  type: 'operation'
  _class: 'OperationGateway'

  toIdentifier: () => Identifier
  toExportPath: () => string
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined
  toEnrichments: () => EnrichmentType
  isSupported: ({ operation, enrichments }: IsSupportedOperationArgs<EnrichmentType>) => boolean

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
  toEnrichments: (value: unknown) => EnrichmentType
  isSupported: ({ operation, enrichments }: IsSupportedOperationArgs<EnrichmentType>) => boolean

  pinnable: boolean

  // deno-lint-ignore ban-types
} & Function
