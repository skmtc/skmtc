import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { toSchemaV3 } from '../schema/toSchemasV3.js'
import type { OasSchema } from '../schema/Schema.js'
import type { OasRef } from '../ref/Ref.js'

type ToAdditionalPropertiesV3Args = {
  additionalProperties:
    | boolean
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.SchemaObject
    | undefined
  context: ParseContext
}

export const toAdditionalPropertiesV3 = ({
  additionalProperties,
  context
}: ToAdditionalPropertiesV3Args):
  | OasSchema
  | OasRef<'schema'>
  | boolean
  | undefined => {
  if (typeof additionalProperties === 'boolean') {
    return additionalProperties
  }

  if (additionalProperties === undefined) {
    return undefined
  }

  return toSchemaV3({ schema: additionalProperties, context })
}
