import * as v from 'valibot'

export const oasNullData = v.object({
  oasType: v.literal('schema'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.null()),
  type: v.literal('null')
})

export type OasNullData = {
  oasType: 'schema'
  title?: string
  description?: string
  default?: null
  type: 'null'
}
