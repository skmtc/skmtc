export type LicenseFields = {
  name?: string
  url?: string
  extensionFields?: Record<string, unknown>
}

export class OasLicense {
  oasType = 'license' as const
  name: string | undefined
  url: string | undefined
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: LicenseFields = {}) {
    this.name = fields.name
    this.url = fields.url
    this.extensionFields = fields.extensionFields
  }
}
