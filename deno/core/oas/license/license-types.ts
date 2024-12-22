import { z } from 'npm:zod@3.23.4'

export type OasLicenseData = {
  oasType: 'license'
  name: string
  url?: string
  identifier?: string
}

export const oasLicenseData: z.ZodType<OasLicenseData> = z.object({
  oasType: z.literal('license'),
  name: z.string(),
  url: z.string().optional(),
  identifier: z.string().optional()
})
