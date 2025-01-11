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
import { z } from '@hono/zod-openapi'

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

const oasHeaderStyle = z.literal('simple')

type OasHeaderStyle = 'simple'

export const oasHeaderData: z.ZodType<OasHeaderData> = z.object({
  oasType: z.literal('header'),
  description: markdown.optional(),
  required: z.boolean().optional(),
  deprecated: z.boolean().optional(),
  allowEmptyValue: z.boolean().optional(),
  // Default values (based on value of in): for query - form; for path - simple; for header - simple; for cookie - form.
  style: oasHeaderStyle.optional(),
  explode: z.boolean().optional(),
  // allowReserved: z.boolean().optional(),
  schema: z.union([oasSchemaData, oasSchemaRefData]).optional(),
  // example: z.any().optional(),
  examples: z.record(z.union([oasExampleData, oasExampleRefData])).optional(),
  content: z.record(oasMediaTypeData).optional()
})

// export type OasHeaders = Record<string, OasHeader | OasHeaderRef>
