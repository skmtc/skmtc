import * as v from 'valibot'

/**
 * Valibot schema for validating integer values.
 * 
 * Ensures values are numbers and specifically integers,
 * used for integer validation throughout OAS processing.
 */
export const integerSchema: v.GenericSchema<number> = v.pipe(v.number(), v.integer())

/**
 * Valibot schema for valid integer format values.
 * 
 * Defines the size formats for integer types: int32 for 32-bit signed
 * integers and int64 for 64-bit signed integers.
 */
export const integerFormat: v.GenericSchema<'int32' | 'int64'> = v.union([v.literal('int32'), v.literal('int64')])

/**
 * Valibot schema for validating OpenAPI integer data objects.
 * 
 * Validates integer schemas including size formats (int32/int64),
 * range constraints, multiple validation, and enumeration values.
 */
export const oasIntegerData: v.GenericSchema<OasIntegerData> = v.object({
  type: v.literal('integer'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(integerSchema),
  format: v.optional(integerFormat),
  enum: v.optional(v.array(integerSchema)),
  nullable: v.optional(v.boolean()),
  example: v.optional(integerSchema),
  multipleOf: v.optional(integerSchema),
  maximum: v.optional(integerSchema),
  exclusiveMaximum: v.optional(v.boolean()),
  minimum: v.optional(integerSchema),
  exclusiveMinimum: v.optional(v.boolean())
})

export type OasIntegerData = {
  type: 'integer'
  title?: string
  description?: string
  default?: number
  format?: 'int32' | 'int64'
  enum?: number[]
  nullable?: boolean
  example?: number
  multipleOf?: number
  maximum?: number
  exclusiveMaximum?: boolean
  minimum?: number
  exclusiveMinimum?: boolean
}
