import * as v from 'valibot'

export type OasDiscriminatorData = {
  oasType: 'discriminator'
  propertyName: string
  mapping?: Record<string, string>
}

export const oasDiscriminatorData = v.object({
  oasType: v.literal('discriminator'),
  propertyName: v.string(),
  mapping: v.optional(v.record(v.string(), v.string()))
})
