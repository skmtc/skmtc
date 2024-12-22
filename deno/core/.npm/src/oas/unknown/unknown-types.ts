import { z } from 'zod'

export const oasUnknownData: z.ZodType<OasUnknownData> = z.object({
  oasType: z.literal('schema'),
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.unknown().optional(),
  type: z.literal('unknown')
})

export type OasUnknownData = {
  oasType: 'schema'
  title?: string
  description?: string
  default?: unknown
  type: 'unknown'
}
