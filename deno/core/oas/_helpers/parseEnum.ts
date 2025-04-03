import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

type ParseEnumArgs<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  value: Omit<Value, 'nullable'>
  nullable: Nullable
  valibotSchema: v.GenericSchema<T>
  context: ParseContext
}

type ParseEnumReturn<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  enum: Nullable extends true ? (T | null)[] | undefined : T[] | undefined
  value: Omit<Value, 'nullable' | 'enum'>
}

export const parseEnum = <
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
>({
  value,
  nullable,
  valibotSchema,
  context
}: ParseEnumArgs<T, Nullable, Value>): ParseEnumReturn<T, Nullable, Value> => {
  const { enum: enums, ...rest } = value

  const parsedEnum = context.provisionalParse({
    key: 'enum',
    value: enums,
    parent: value,
    schema: nullable === true ? v.array(v.nullable(valibotSchema)) : v.array(valibotSchema),
    toMessage: value => `Removed invalid enum. Expected ${valibotSchema.type}, got: ${value}`,
    type: 'INCORRECT_ENUM'
  })

  return {
    enum: parsedEnum,
    value: rest
  } as ParseEnumReturn<T, Nullable, Value>
}
