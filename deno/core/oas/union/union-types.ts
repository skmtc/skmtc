import * as v from 'valibot'
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

export const oasUnionData = v.object({
  oasType: v.literal('schema'),
  type: v.literal('union'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  members: v.lazy(() => v.array(v.union([oasSchemaData, oasSchemaRefData]))),
  discriminator: v.optional(oasDiscriminatorData)
})
