import * as v from 'valibot'

export const oasBooleanData: v.GenericSchema<OasBooleanData> = v.object({
  oasType: v.literal('schema'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.boolean()),
  type: v.literal('boolean')
})

export type OasBooleanData = {
  oasType: 'schema'
  title?: string
  description?: string
  default?: boolean
  type: 'boolean'
}
