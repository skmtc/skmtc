import * as v from 'valibot'

export const oasNumberData = v.object({
  oasType: v.literal('schema'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.number()),
  type: v.literal('number')
  // Add soon
  // multipleOf: v.optional(v.number()),
  // maximum: v.optional(v.number()),
  // exclusiveMaximum: v.optional(v.boolean()),
  // minimum: v.optional(v.number()),
  // exclusiveMinimum: v.optional(v.boolean())
})

export type OasNumberData = {
  oasType: 'schema'
  title?: string
  description?: string
  default?: number
  type: 'number'
}
