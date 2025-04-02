import { type OasExampleData, oasExampleData } from '../example/example-types.ts'
import {
  type OasExampleRefData,
  type OasSchemaRefData,
  oasExampleRefData,
  oasSchemaRefData
} from '../ref/ref-types.ts'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import * as v from 'valibot'

export type OasMediaTypeData = {
  oasType: 'mediaType'
  mediaType: string
  schema?: OasSchemaData | OasSchemaRefData
  // example?: unknown
  examples?: Record<string, OasExampleData | OasExampleRefData>
  // encoding?: Record<string, OasEncodingData>
}

export const oasMediaTypeData = v.object({
  oasType: v.literal('mediaType'),
  mediaType: v.string(),
  schema: v.optional(v.union([oasSchemaData, oasSchemaRefData])),
  // example: z.any().optional(),
  examples: v.optional(v.record(v.string(), v.union([oasExampleData, oasExampleRefData])))
  // encoding: z.lazy(() => z.record(encoding).optional())
})
