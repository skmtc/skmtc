import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

type ParseExampleArgs<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  value: Omit<Value, 'nullable'>
  nullable: Nullable
  valibotSchema: v.GenericSchema<T>
  context: ParseContext
}

type ParseExampleReturn<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  example: Nullable extends true ? T | null | undefined : T | undefined
  value: Omit<Value, 'nullable' | 'example'>
}

export const parseExample = <
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
>({
  value,
  nullable,
  valibotSchema,
  context
}: ParseExampleArgs<T, Nullable, Value>): ParseExampleReturn<T, Nullable, Value> => {
  const { example, ...rest } = value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    parent: value,
    schema: nullable === true ? v.nullable(valibotSchema) : valibotSchema,
    toMessage: value => `Removed invalid example. Expected ${valibotSchema.type}, got: ${value}`,
    type: 'INVALID_EXAMPLE'
  })

  return {
    example: parsedExample,
    value: rest
  } as ParseExampleReturn<T, Nullable, Value>
}
