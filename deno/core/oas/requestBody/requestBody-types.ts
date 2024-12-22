import { markdown } from '../markdown/markdown-types.ts'
import {
  type OasMediaTypeData,
  oasMediaTypeData
} from '../mediaType/mediaType-types.ts'
import { z } from 'npm:zod@3.24.1'

export type OasRequestBodyData = {
  oasType: 'requestBody'
  description?: string
  content: Record<string, OasMediaTypeData>
  required?: boolean
}

export const oasRequestBodyData: z.ZodType<OasRequestBodyData> = z.object({
  oasType: z.literal('requestBody'),
  description: markdown.optional(),
  content: z.record(oasMediaTypeData),
  required: z.boolean().optional()
})
