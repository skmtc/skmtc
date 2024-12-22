export type ContactFields = {
  name?: string
  url?: string
  email?: string
  extensionFields?: Record<string, unknown>
}

export class OasContact {
  oasType = 'contact' as const

  name: string | undefined
  url: string | undefined
  email: string | undefined
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: ContactFields) {
    this.name = fields.name
    this.url = fields.url
    this.email = fields.email
    this.extensionFields = fields.extensionFields
  }
}
