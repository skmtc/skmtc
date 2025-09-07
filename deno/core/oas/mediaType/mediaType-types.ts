import { type OasExampleData, oasExampleData } from '../example/example-types.ts'
import {
  type OasExampleRefData,
  type OasSchemaRefData,
  oasExampleRefData,
  oasSchemaRefData
} from '../ref/ref-types.ts'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import * as v from 'valibot'

/**
 * Data type for OpenAPI media type objects.
 * 
 * Represents media type definitions within request/response bodies,
 * specifying the format, schema, and examples for different content types
 * like application/json, multipart/form-data, etc.
 */
export type OasMediaTypeData = {
  /** Type identifier for OAS media type objects */
  oasType: 'mediaType'
  /** The media type identifier (e.g., 'application/json', 'text/plain') */
  mediaType: string
  /** Schema definition for the media type content */
  schema?: OasSchemaData | OasSchemaRefData
  // example?: unknown
  /** Named examples for the media type content */
  examples?: Record<string, OasExampleData | OasExampleRefData>
  // encoding?: Record<string, OasEncodingData>
}

/**
 * Valibot schema for validating OpenAPI media type data.
 * 
 * Validates the structure of media type objects including content type
 * identifiers, schema definitions, and example collections.
 */
export const oasMediaTypeData: v.GenericSchema<OasMediaTypeData> = v.object({
  oasType: v.literal('mediaType'),
  mediaType: v.string(),
  schema: v.optional(v.union([oasSchemaData, oasSchemaRefData])),
  // example: z.any().optional(),
  examples: v.optional(v.record(v.string(), v.union([oasExampleData, oasExampleRefData])))
  // encoding: z.lazy(() => z.record(encoding).optional())
})
