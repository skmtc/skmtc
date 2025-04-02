import * as v from 'valibot'

export const oasUnknownData = v.object({
  oasType: v.literal('schema'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.unknown()),
  type: v.literal('unknown')
})

export type OasUnknownData = {
  oasType: 'schema'
  title?: string
  description?: string
  default?: unknown
  type: 'unknown'
}
