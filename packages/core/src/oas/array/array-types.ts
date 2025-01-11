import { z } from '@hono/zod-openapi'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.js'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.js'

export const oasArrayData: z.ZodType<OasArrayData> = z.object({
  oasType: z.literal('schema'),
  // Add soon
  type: z.literal('array'),
  // additionalItems: z.lazy(() => z.union([z.boolean(), jsonSchema4]).optional()),
  items: z.lazy(() => z.union([oasSchemaData, oasSchemaRefData])),
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.array(z.unknown()).optional()

  // Add soon
  // maxItems: z.number().optional(),
  // minItems: z.number().optional(),
  // uniqueItems: z.boolean().optional()
})

export type OasArrayData = {
  oasType: 'schema'
  type: 'array'
  items: OasSchemaData | OasSchemaRefData
  title?: string
  description?: string
  default?: unknown[]
}
