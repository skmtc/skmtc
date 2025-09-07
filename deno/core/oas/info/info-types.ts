import { type OasLicenseData, oasLicenseData } from '../license/license-types.ts'
import { type OasContactData, oasContactData } from '../contact/contact-types.ts'
import { markdown } from '../markdown/markdown-types.ts'
import * as v from 'valibot'

export type OasInfoData = {
  oasType: 'info'
  title: string
  description?: string
  termsOfService?: string
  contact?: OasContactData
  license?: OasLicenseData
  version: string
}

export const oasInfoData: v.GenericSchema<OasInfoData> = v.object({
  oasType: v.literal('info'),
  title: v.string(),
  description: v.optional(markdown),
  termsOfService: v.optional(v.string()),
  contact: v.optional(oasContactData),
  license: v.optional(oasLicenseData),
  version: v.string()
})
