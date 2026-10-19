export type DiscriminatorFields = {
  propertyName: string
  mapping?: Record<string, string>
  /** Schema to use when the discriminating value has no mapping entry (OpenAPI 3.2) */
  defaultMapping?: string
}

export class OasDiscriminator {
  oasType: 'discriminator' = 'discriminator'
  propertyName: string
  mapping?: Record<string, string>
  defaultMapping?: string

  constructor(fields: DiscriminatorFields) {
    this.propertyName = fields.propertyName
    this.mapping = fields.mapping
    this.defaultMapping = fields.defaultMapping
  }
}
