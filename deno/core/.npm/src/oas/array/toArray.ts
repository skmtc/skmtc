import type { OpenAPIV3 } from 'openapi-types'
import { OasArray } from './Array.js'
import { toSchemaV3 } from '../schema/toSchemasV3.js'
import type { ParseContext } from '../../context/ParseContext.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'

type ToArrayArgs = {
  value: OpenAPIV3.ArraySchemaObject
  context: ParseContext
}

export const toArray = ({ value, context }: ToArrayArgs): OasArray => {
  const {
    type: _type,
    items,
    title,
    description,
    nullable,
    uniqueItems,
    example,
    ...skipped
  } = value

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasArray({
    title,
    description,
    nullable,
    uniqueItems,
    items: context.trace('items', () => toSchemaV3({ schema: items, context })),
    extensionFields,
    example
  })
}
