import { z } from 'npm:zod@3.24.1'

export type OasDiscriminatorData = {
  oasType: 'discriminator'
  propertyName: string
  mapping?: Record<string, string>
}

export const oasDiscriminatorData: z.ZodType<OasDiscriminatorData> = z.object({
  oasType: z.literal('discriminator'),
  propertyName: z.string(),
  mapping: z.record(z.string()).optional()
})
