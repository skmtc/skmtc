export type DiscriminatorFields = {
  propertyName: string
}

export class OasDiscriminator {
  oasType: 'discriminator' = 'discriminator'
  propertyName: string

  constructor(fields: DiscriminatorFields) {
    this.propertyName = fields.propertyName
  }
}
