import { markdown } from '../markdown/markdown-types.ts'
import { type OasMediaTypeData, oasMediaTypeData } from '../mediaType/mediaType-types.ts'
import * as v from 'valibot'

export type OasRequestBodyData = {
  oasType: 'requestBody'
  description?: string
  content: Record<string, OasMediaTypeData>
  required?: boolean
}

export const oasRequestBodyData = v.object({
  oasType: v.literal('requestBody'),
  description: v.optional(markdown),
  content: v.record(v.string(), oasMediaTypeData),
  required: v.optional(v.boolean())
})
