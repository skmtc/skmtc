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

export type OasParameterLocation = 'query' | 'header' | 'path' | 'cookie'

export const oasParameterLocation: v.GenericSchema<OasParameterLocation> = v.enum({
  query: 'query',
  header: 'header',
  path: 'path',
  cookie: 'cookie'
})

export type OasParameterStyle =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject'

export const oasParameterStyle: v.GenericSchema<OasParameterStyle> = v.enum({
  matrix: 'matrix',
  label: 'label',
  form: 'form',
  simple: 'simple',
  spaceDelimited: 'spaceDelimited',
  pipeDelimited: 'pipeDelimited',
  deepObject: 'deepObject'
})

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

export const oasParameterData: v.GenericSchema<OasParameterData> = v.object({
  oasType: v.literal('parameter'),
  allowEmptyValue: v.optional(v.boolean()),
  allowReserved: v.optional(v.boolean()),
  content: v.optional(v.record(v.string(), oasMediaTypeData)),
  deprecated: v.optional(v.boolean()),
  description: v.optional(markdown),
  examples: v.optional(v.record(v.string(), v.union([oasExampleData, oasExampleRefData]))),
  explode: v.boolean(),
  location: oasParameterLocation,
  name: v.string(),
  required: v.optional(v.boolean()),
  schema: v.optional(v.union([oasSchemaData, oasSchemaRefData])),
  style: oasParameterStyle
})
