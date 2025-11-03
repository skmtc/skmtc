import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasUnknown } from './Unknown.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToUnknownArgs = {
  value: OpenAPIV3.SchemaObject

  context: ParseContextType
}

export const toUnknown = ({ value, context }: ToUnknownArgs): OasUnknown => {
  const { type: _type, title, description, example, nullable, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    parentType: 'schema:unknown'
  })

  return new OasUnknown({
    title,
    description,
    nullable,
    extensionFields,
    example
  })
}
