import { type OasLicenseData, oasLicenseData } from '../license/license-types.ts'
import { type OasContactData, oasContactData } from '../contact/contact-types.ts'
import { markdown } from '../markdown/markdown-types.ts'
import { z } from 'zod'

export type OasInfoData = {
  oasType: 'info'
  title: string
  description?: string
  termsOfService?: string
  contact?: OasContactData
  license?: OasLicenseData
  version: string
}

export const oasInfoData: z.ZodType<OasInfoData> = z.object({
  oasType: z.literal('info'),
  title: z.string(),
  description: markdown.optional(),
  termsOfService: z.string().optional(),
  contact: oasContactData.optional(),
  license: oasLicenseData.optional(),
  version: z.string()
})
