import * as v from 'valibot'

export const integerSchema = v.pipe(v.number(), v.integer())

export const integerFormat = v.union([v.literal('int32'), v.literal('int64')])

export const oasIntegerData = v.object({
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
