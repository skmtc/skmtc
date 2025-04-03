import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

export type ParseNullableArgs<Value extends OpenAPIV3.SchemaObject> = {
  value: Value
  context: ParseContext
}

export type ParseNullableReturn<Value extends OpenAPIV3.SchemaObject> = {
  nullable: boolean | undefined
  value: Omit<Value, 'nullable'>
}

export const parseNullable = <Value extends OpenAPIV3.SchemaObject>({
  value,
  context
}: ParseNullableArgs<Value>): ParseNullableReturn<Value> => {
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
