import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasObject, type OasObjectFields } from './Object.ts'
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.ts'
import { toAdditionalPropertiesV3 } from './toAdditionalPropertiesV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToObjectArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toObject = ({ value, context }: ToObjectArgs): OasObject => {
  const {
    type: _type,
    title,
    description,
    properties,
    required,
    additionalProperties,
    nullable,
    example,
    ...skipped
  } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  const fields: OasObjectFields = {
    title,
    description,
    nullable,
    example,
    properties: context.trace('properties', () =>
      toOptionalSchemasV3({
        schemas: properties,
        context
      })
    ),
    required: required,
    additionalProperties: context.trace('additionalProperties', () =>
      toAdditionalPropertiesV3({ additionalProperties, context })
    ),
    extensionFields
  }

  return new OasObject(fields)
}
