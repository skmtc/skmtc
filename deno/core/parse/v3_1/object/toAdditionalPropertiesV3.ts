import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toSchemaV3 } from '@/parse/v3_1/schema/toSchemasV3.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToAdditionalPropertiesV3Args = {
  additionalProperties: boolean | OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toAdditionalPropertiesV3 = ({
  additionalProperties,
  stackTrail,
  context
}: ToAdditionalPropertiesV3Args): OasSchema | OasRef<'schema'> | boolean | undefined => {
  if (typeof additionalProperties === 'boolean') {
    return additionalProperties
  }

  if (additionalProperties === undefined) {
    return undefined
  }

  return toSchemaV3({ schema: additionalProperties, stackTrail, context })
}
