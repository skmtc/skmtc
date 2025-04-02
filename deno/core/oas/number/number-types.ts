import * as v from 'valibot'

export const oasNumberData = v.object({
  type: v.literal('number'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.number()),
  format: v.optional(v.union([v.literal('float'), v.literal('double')])),
  enum: v.optional(v.array(v.number())),
  nullable: v.optional(v.boolean()),
  example: v.optional(v.number()),
  multipleOf: v.optional(v.number()),
  maximum: v.optional(v.number()),
  exclusiveMaximum: v.optional(v.boolean()),
  minimum: v.optional(v.number()),
  exclusiveMinimum: v.optional(v.boolean())
})

export type OasNumberData = {
  type: 'number'
  title?: string
  description?: string
  default?: number
  format?: 'float' | 'double'
  enum?: number[]
  nullable?: boolean
  example?: number
  multipleOf?: number
  maximum?: number
  exclusiveMaximum?: boolean
  minimum?: number
  exclusiveMinimum?: boolean
}
