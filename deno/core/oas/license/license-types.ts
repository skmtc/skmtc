import * as v from 'valibot'

export type OasLicenseData = {
  oasType: 'license'
  name: string
  url?: string
  identifier?: string
}

export const oasLicenseData: v.GenericSchema<OasLicenseData> = v.object({
  oasType: v.literal('license'),
  name: v.string(),
  url: v.optional(v.string()),
  identifier: v.optional(v.string())
})
