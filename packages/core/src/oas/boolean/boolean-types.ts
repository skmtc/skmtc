import { z } from 'zod'

export const oasBooleanData: z.ZodType<OasBooleanData> = z.object({
  oasType: z.literal('schema'),
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.boolean().optional(),
  type: z.literal('boolean')
})

export type OasBooleanData = {
  oasType: 'schema'
  title?: string
  description?: string
  default?: boolean
  type: 'boolean'
}
