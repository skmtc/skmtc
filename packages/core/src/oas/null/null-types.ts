import { z } from '@hono/zod-openapi'
export const oasNullData: z.ZodType<OasNullData> = z.object({
  oasType: z.literal('schema'),
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.null().optional(),
  type: z.literal('null')
})

export type OasNullData = {
  oasType: 'schema'
  title?: string
  description?: string
  default?: null
  type: 'null'
}
