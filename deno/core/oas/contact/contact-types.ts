import { z } from '@hono/zod-openapi'

export type OasContactData = {
  oasType: 'contact'
  name?: string
  url?: string
  email?: string
}

export const oasContactData: z.ZodType<OasContactData> = z.object({
  oasType: z.literal('contact'),
  name: z.string().optional(),
  url: z.string().optional(),
  email: z.string().email().optional()
})
