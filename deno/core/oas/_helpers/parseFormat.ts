import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

type ParseFormatArgs<T> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  valibotSchema: v.GenericSchema<T>
  context: ParseContext
}

type ParseFormatReturn<T, Value extends OpenAPIV3.SchemaObject> = {
  format: T | undefined
  value: Omit<Value, 'format'>
}

export const parseFormat = <T, Value extends OpenAPIV3.SchemaObject>({
  value,
  valibotSchema,
  context
}: ParseFormatArgs<T>): ParseFormatReturn<T, Value> => {
  const { format, ...rest } = value

  const parsedFormat = context.provisionalParse({
    key: 'format',
    value: format,
    parent: value,
    schema: v.optional(valibotSchema),
    toMessage: value => `Unexpected "${rest.type}" format: ${value}`,
    type: 'INVALID_FORMAT'
  })

  return {
    format: parsedFormat,
    value: rest
  } as ParseFormatReturn<T, Value>
}
