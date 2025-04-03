import * as v from 'valibot'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.ts'

export const oasArrayData = v.object({
  type: v.literal('array'),
  items: v.lazy(() => v.union([v.lazy(() => oasSchemaData), oasSchemaRefData])),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.array(v.unknown())),
  maxItems: v.optional(v.number()),
  minItems: v.optional(v.number()),
  uniqueItems: v.optional(v.boolean()),
  enums: v.optional(v.array(v.unknown()))
})

export type OasArrayData = {
  type: 'array'
  items: OasSchemaData | OasSchemaRefData
  title?: string
  description?: string
  default?: unknown[]
  maxItems?: number
  minItems?: number
  uniqueItems?: boolean
  enums?: unknown[]
}
