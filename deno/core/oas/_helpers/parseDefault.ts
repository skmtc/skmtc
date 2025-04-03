import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

type ParseDefaultArgs<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  value: Omit<Value, 'nullable' | 'example' | 'enum'>
  nullable: Nullable
  valibotSchema: v.GenericSchema<T>
  context: ParseContext
}

type ParseDefaultReturn<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  default: Nullable extends true ? T | null | undefined : T | undefined
  value: Omit<Value, 'nullable' | 'example' | 'enum' | 'default'>
}

export const parseDefault = <
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
>({
  value,
  nullable,
  valibotSchema,
  context
}: ParseDefaultArgs<T, Nullable, Value>): ParseDefaultReturn<T, Nullable, Value> => {
  const { default: defaultValue, ...rest } = value

  const parsedDefault = context.provisionalParse({
    key: 'default',
    value: defaultValue,
    parent: value,
    schema: nullable === true ? v.nullable(valibotSchema) : valibotSchema,
    toMessage: value => `Removed invalid default. Expected ${valibotSchema.type}, got: ${value}`
  })

  return {
    default: parsedDefault,
    value: rest
  } as ParseDefaultReturn<T, Nullable, Value>
}
