import { z } from 'zod'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.ts'
import {
  type OasDiscriminatorData,
  oasDiscriminatorData
} from '../discriminator/discriminator-types.ts'

export type OasUnionData = {
  oasType: 'schema'
  type: 'union'
  title?: string
  description?: string
  members: (OasSchemaData | OasSchemaRefData)[]
  discriminator?: OasDiscriminatorData
}

export const oasUnionData: z.ZodType<OasUnionData> = z.object({
  oasType: z.literal('schema'),
  type: z.literal('union'),
  title: z.string().optional(),
  description: z.string().optional(),
  members: z.lazy(() => z.array(z.union([oasSchemaData, oasSchemaRefData]))),
  discriminator: oasDiscriminatorData.optional()
})
