import { type OasExampleData, oasExampleData } from '../example/example-types.ts'
import { markdown } from '../markdown/markdown-types.ts'
import { type OasMediaTypeData, oasMediaTypeData } from '../mediaType/mediaType-types.ts'
import {
  type OasExampleRefData,
  type OasSchemaRefData,
  oasExampleRefData,
  oasSchemaRefData
} from '../ref/ref-types.ts'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import * as v from 'valibot'

export type OasHeaderData = {
  oasType: 'header'
  description?: string
  required?: boolean
  deprecated?: boolean
  allowEmptyValue?: boolean
  schema?: OasSchemaData | OasSchemaRefData
  examples?: Record<string, OasExampleData | OasExampleRefData>
  content?: Record<string, OasMediaTypeData>
  style?: OasHeaderStyle
  explode?: boolean
}

const oasHeaderStyle = v.literal('simple')

type OasHeaderStyle = 'simple'

export const oasHeaderData = v.object({
  oasType: v.literal('header'),
  description: v.optional(markdown),
  required: v.optional(v.boolean()),
  deprecated: v.optional(v.boolean()),
  allowEmptyValue: v.optional(v.boolean()),
  // Default values (based on value of in): for query - form; for path - simple; for header - simple; for cookie - form.
  style: v.optional(oasHeaderStyle),
  explode: v.optional(v.boolean()),
  // allowReserved: v.boolean().optional(),
  schema: v.optional(v.union([oasSchemaData, oasSchemaRefData])),
  // example: z.any().optional(),
  examples: v.optional(v.record(v.string(), v.union([oasExampleData, oasExampleRefData]))),
  content: v.optional(v.record(v.string(), oasMediaTypeData))
})

// export type OasHeaders = Record<string, OasHeader | OasHeaderRef>
