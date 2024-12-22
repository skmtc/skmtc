import {
  type OasExampleData,
  oasExampleData
} from '../example/example-types.ts'
import {
  type OasExampleRefData,
  type OasSchemaRefData,
  oasExampleRefData,
  oasSchemaRefData
} from '../ref/ref-types.ts'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { z } from 'npm:zod@3.23.4'

export type OasMediaTypeData = {
  oasType: 'mediaType'
  mediaType: string
  schema?: OasSchemaData | OasSchemaRefData
  // example?: unknown
  examples?: Record<string, OasExampleData | OasExampleRefData>
  // encoding?: Record<string, OasEncodingData>
}

export const oasMediaTypeData: z.ZodType<OasMediaTypeData> = z.object({
  oasType: z.literal('mediaType'),
  mediaType: z.string(),
  schema: z.union([oasSchemaData, oasSchemaRefData]).optional(),
  // example: z.any().optional(),
  examples: z.record(z.union([oasExampleData, oasExampleRefData])).optional()
  // encoding: z.lazy(() => z.record(encoding).optional())
})
