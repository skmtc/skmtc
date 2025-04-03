import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

type ParseExampleArgs<T, Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.NonArraySchemaObject, 'nullable'>
  nullable: Nullable
  valibotSchema: v.GenericSchema<T>
  context: ParseContext
}

type ParseExampleReturn<T, Nullable extends boolean | undefined> = {
  example: Nullable extends true ? T | null | undefined : T | undefined
  value: Omit<OpenAPIV3.NonArraySchemaObject, 'nullable' | 'example'>
}

export const parseExample = <T, Nullable extends boolean | undefined>({
  value,
  nullable,
  valibotSchema,
  context
}: ParseExampleArgs<T, Nullable>): ParseExampleReturn<T, Nullable> => {
  const { example, ...rest } = value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    parent: value,
    schema: nullable === true ? v.nullable(valibotSchema) : valibotSchema,
    toMessage: value => `Removed invalid example. Expected ${valibotSchema.type}, got: ${value}`
  })

  return {
    example: parsedExample,
    value: rest
  } as ParseExampleReturn<T, Nullable>
}
