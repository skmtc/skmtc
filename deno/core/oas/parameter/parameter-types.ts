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
import { z } from 'zod'

export type OasParameterLocation = 'query' | 'header' | 'path' | 'cookie'

export const oasParameterLocation: z.ZodType<OasParameterLocation> = z.enum([
  'query',
  'header',
  'path',
  'cookie'
])

export type OasParameterStyle =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject'

export const oasParameterStyle: z.ZodType<OasParameterStyle> = z.enum([
  'matrix',
  'label',
  'form',
  'simple',
  'spaceDelimited',
  'pipeDelimited',
  'deepObject'
])

export type OasParameterData = {
  oasType: 'parameter'
  allowEmptyValue?: boolean
  allowReserved?: boolean
  content?: Record<string, OasMediaTypeData>
  deprecated?: boolean
  description?: string
  examples?: Record<string, OasExampleData | OasExampleRefData>
  explode: boolean
  location: OasParameterLocation
  name: string
  required?: boolean
  schema?: OasSchemaData | OasSchemaRefData
  style: OasParameterStyle
}

export const oasParameterData: z.ZodType<OasParameterData> = z.object({
  oasType: z.literal('parameter'),
  // Default values (based on value of in): for query - form; for path - simple; for header - simple; for cookie - form.
  // example: z.any().optional(),
  allowReserved: z.boolean().optional(),
  allowEmptyValue: z.boolean().optional(),
  content: z.record(oasMediaTypeData).optional(),
  deprecated: z.boolean().optional(),
  description: markdown.optional(),
  examples: z.record(z.union([oasExampleData, oasExampleRefData])).optional(),
  explode: z.boolean(),
  location: oasParameterLocation,
  name: z.string(),
  required: z.boolean().optional(),
  schema: z.union([oasSchemaData, oasSchemaRefData]).optional(),
  style: oasParameterStyle
})
