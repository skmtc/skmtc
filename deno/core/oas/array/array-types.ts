import * as v from 'valibot'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.ts'

export const oasArrayData = v.object({
  oasType: v.literal('schema'),
  // Add soon
  type: v.literal('array'),
  // additionalItems: v.optional(v.union([v.boolean(), jsonSchema4])),
  items: v.lazy(() => v.union([v.lazy(() => oasSchemaData), oasSchemaRefData])),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.array(v.unknown()))

  // Add soon
  // maxItems: v.optional(v.number()),
  // minItems: v.optional(v.number()),
  // uniqueItems: v.optional(v.boolean())
})

export type OasArrayData = {
  oasType: 'schema'
  type: 'array'
  items: OasSchemaData | OasSchemaRefData
  title?: string
  description?: string
  default?: unknown[]
}
