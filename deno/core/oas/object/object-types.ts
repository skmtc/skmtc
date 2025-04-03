import * as v from 'valibot'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.ts'

export const oasObjectData: v.GenericSchema<OasObjectData> = v.object({
  type: v.literal('object'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.object({})),
  maxProperties: v.optional(v.number()),
  minProperties: v.optional(v.number()),
  properties: v.optional(
    v.record(v.string(), v.union([v.lazy(() => oasSchemaData), oasSchemaRefData]))
  ),
  readOnly: v.optional(v.boolean()),
  writeOnly: v.optional(v.boolean()),
  // Add soon
  // patternProperties: z.lazy(() => z.record(jsonSchema4).optional()),
  required: v.optional(v.array(v.string())),
  // allOf: z.lazy(() => z.array(oasObject).optional()),

  // Use oneOf instead of anyOf
  // anyOf: z.lazy(() => z.array(jsonSchema4).optional()),
  // oneOf: z.lazy(() => z.array(oasObject).optional()),
  additionalProperties: v.optional(
    v.union([v.boolean(), v.lazy(() => oasSchemaData), oasSchemaRefData])
  )
})

export type OasObjectData = {
  type: 'object'
  title?: string
  description?: string
  default?: Record<string, unknown>
  maxProperties?: number
  minProperties?: number
  properties?: Record<string, OasSchemaData | OasSchemaRefData>
  required?: string[]
  additionalProperties?: boolean | OasSchemaData | OasSchemaRefData
  readOnly?: boolean
  writeOnly?: boolean
}
