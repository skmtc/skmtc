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

/**
 * Data type for OpenAPI header objects in the SKMTC internal representation.
 * 
 * Represents HTTP headers in OpenAPI specifications, including validation
 * rules, examples, and serialization parameters. Headers are used in
 * responses and can include complex schemas and multiple examples.
 */
export type OasHeaderData = {
  /** Type identifier for OAS header objects */
  oasType: 'header'
  /** Human-readable description of the header */
  description?: string
  /** Whether the header is required */
  required?: boolean
  /** Whether the header is deprecated */
  deprecated?: boolean
  /** Whether empty values are allowed for the header */
  allowEmptyValue?: boolean
  /** Schema definition for the header value */
  schema?: OasSchemaData | OasSchemaRefData
  /** Named examples for the header value */
  examples?: Record<string, OasExampleData | OasExampleRefData>
  /** Media type definitions for complex header content */
  content?: Record<string, OasMediaTypeData>
  /** Serialization style (always 'simple' for headers) */
  style?: OasHeaderStyle
  /** Whether to explode parameter values */
  explode?: boolean
}

const oasHeaderStyle: v.LiteralSchema<'simple', 'simple'> = v.literal('simple')

/**
 * Valid serialization styles for OpenAPI headers.
 * 
 * Headers can only use the 'simple' serialization style according to
 * the OpenAPI specification.
 */
export type OasHeaderStyle = 'simple'

/**
 * Valibot schema for validating OAS header data structures.
 * 
 * Validates the structure and content of OpenAPI header objects,
 * ensuring proper types for all fields including nested schemas,
 * examples, and content definitions.
 */
export const oasHeaderData: v.GenericSchema<OasHeaderData> = v.object({
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
