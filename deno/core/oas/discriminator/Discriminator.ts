export type DiscriminatorFields = {
  propertyName: string
  mapping?: Record<string, string>
}

export class OasDiscriminator {
  oasType: 'discriminator' = 'discriminator'
  propertyName: string
  mapping?: Record<string, string>

  constructor(fields: DiscriminatorFields) {
    this.propertyName = fields.propertyName
    this.mapping = fields.mapping
  }
}
