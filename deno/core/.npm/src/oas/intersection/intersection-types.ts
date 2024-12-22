import { z } from 'zod'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.js'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.js'
import {
  type OasDiscriminatorData,
  oasDiscriminatorData
} from '../discriminator/discriminator-types.js'

export type OasIntersectionData = {
  oasType: 'schema'
  type: 'intersection'
  title?: string
  description?: string
  members: (OasSchemaData | OasSchemaRefData)[]
  discriminator?: OasDiscriminatorData
}

export const oasIntersectionData: z.ZodType<OasIntersectionData> = z.object({
  oasType: z.literal('schema'),
  type: z.literal('intersection'),
  title: z.string().optional(),
  description: z.string().optional(),
  members: z.lazy(() => z.array(z.union([oasSchemaData, oasSchemaRefData]))),
  discriminator: oasDiscriminatorData.optional()
})
