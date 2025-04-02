import * as v from 'valibot'

export const oasBooleanData: v.GenericSchema<OasBooleanData> = v.object({
  type: v.literal('boolean'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.boolean()),
  enum: v.optional(v.array(v.boolean()))
})

export type OasBooleanData = {
  type: 'boolean'
  title?: string
  description?: string
  default?: boolean
  enum?: boolean[]
}
