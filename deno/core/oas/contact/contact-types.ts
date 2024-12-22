import { z } from 'npm:zod@3.23.4'

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
