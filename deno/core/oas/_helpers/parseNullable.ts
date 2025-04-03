import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

export type ParseNullableArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export type ParseNullableReturn = {
  nullable: boolean | undefined
  value: Omit<OpenAPIV3.NonArraySchemaObject, 'nullable'>
}

export const parseNullable = ({ value, context }: ParseNullableArgs): ParseNullableReturn => {
  const { nullable, ...rest } = value

  const parsedNullable = context.provisionalParse({
    key: 'nullable',
    value: nullable,
    parent: value,
    schema: v.optional(v.boolean()),
    toMessage: (input: unknown) => `Invalid nullable: ${input}`
  })

  return {
    nullable: parsedNullable,
    value: rest
  }
}
