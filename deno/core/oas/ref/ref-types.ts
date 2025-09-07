import { markdown } from '../markdown/markdown-types.ts'
import * as v from 'valibot'

/**
 * Data type for OpenAPI schema reference objects.
 * 
 * Represents $ref references to schema objects in OpenAPI documents,
 * allowing for component reuse and circular reference handling.
 */
export type OasSchemaRefData = {
  /** Type identifier for OAS reference objects */
  oasType: 'ref'
  /** The type of object being referenced */
  refType: 'schema'
  /** The reference path (e.g., '#/components/schemas/User') */
  $ref: string
  /** Optional summary for the reference */
  summary?: string
  /** Optional description for the reference */
  description?: string
}

/**
 * Valibot schema for validating schema reference data.
 */
export const oasSchemaRefData: v.GenericSchema<OasSchemaRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('schema'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

/**
 * Data type for OpenAPI response reference objects.
 * 
 * Represents $ref references to response objects in OpenAPI documents,
 * enabling response definition reuse across multiple operations.
 */
export type OasResponseRefData = {
  /** Type identifier for OAS reference objects */
  oasType: 'ref'
  /** The type of object being referenced */
  refType: 'response'
  /** The reference path (e.g., '#/components/responses/NotFound') */
  $ref: string
  /** Optional summary for the reference */
  summary?: string
  /** Optional description for the reference */
  description?: string
}

/**
 * Valibot schema for validating response reference data.
 */
export const oasResponseRefData: v.GenericSchema<OasResponseRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('response'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

/**
 * Data type for OpenAPI parameter reference objects.
 * 
 * Represents $ref references to parameter objects in OpenAPI documents,
 * allowing parameter definitions to be reused across operations.
 */
export type OasParameterRefData = {
  /** Type identifier for OAS reference objects */
  oasType: 'ref'
  /** The type of object being referenced */
  refType: 'parameter'
  /** The reference path (e.g., '#/components/parameters/PageSize') */
  $ref: string
  /** Optional summary for the reference */
  summary?: string
  /** Optional description for the reference */
  description?: string
}

/**
 * Valibot schema for validating parameter reference data.
 */
export const oasParameterRefData: v.GenericSchema<OasParameterRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('parameter'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

/**
 * Data type for OpenAPI example reference objects.
 * 
 * Represents $ref references to example objects in OpenAPI documents,
 * enabling example reuse across multiple schema definitions and operations.
 */
export type OasExampleRefData = {
  oasType: 'ref'
  refType: 'example'
  $ref: string
  summary?: string
  description?: string
}

/**
 * Valibot schema for validating example reference data.
 */
export const oasExampleRefData: v.GenericSchema<OasExampleRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('example'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

/**
 * Data type for OpenAPI request body reference objects.
 * 
 * Represents $ref references to request body objects in OpenAPI documents,
 * allowing request body definitions to be reused across operations.
 */
export type OasRequestBodyRefData = {
  oasType: 'ref'
  refType: 'requestBody'
  $ref: string
  summary?: string
  description?: string
}

/**
 * Valibot schema for validating request body reference data.
 */
export const oasRequestBodyRefData: v.GenericSchema<OasRequestBodyRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('requestBody'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})
/**
 * Data type for OpenAPI header reference objects.
 * 
 * Represents $ref references to header objects in OpenAPI documents,
 * enabling header definition reuse across operations and responses.
 */
export type OasHeaderRefData = {
  oasType: 'ref'
  refType: 'header'
  $ref: string
  summary?: string
  description?: string
}

/**
 * Valibot schema for validating header reference data.
 */
export const oasHeaderRefData: v.GenericSchema<OasHeaderRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('header'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

/**
 * Data type for OpenAPI security scheme reference objects.
 * 
 * Represents $ref references to security scheme objects in OpenAPI documents,
 * allowing security scheme definitions to be reused across operations.
 */
export type OasSecuritySchemeRefData = {
  oasType: 'ref'
  refType: 'securityScheme'
  $ref: string
}

/**
 * Valibot schema for validating security scheme reference data.
 */
export const oasSecuritySchemeRefData: v.GenericSchema<OasSecuritySchemeRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('securityScheme'),
  $ref: v.string()
})

// export const oasPathItemRefData = z.object({
//   oasType: z.literal('ref'),
//   refType: z.enum(['pathItem']),
//   $ref: z.string(),
//   summary: z.string().optional(),
//   description: markdown.optional()
// })

/**
 * Union type representing all possible OpenAPI reference data types.
 * 
 * Encompasses all supported reference types in the OpenAPI specification,
 * providing type-safe handling of references to various component types.
 */
export type OasRefData =
  | OasSchemaRefData
  | OasResponseRefData
  | OasParameterRefData
  | OasExampleRefData
  | OasRequestBodyRefData
  | OasHeaderRefData
  | OasSecuritySchemeRefData
// OasPathItemRefData

/**
 * Valibot schema for validating any OpenAPI reference data.
 * 
 * Union schema that validates all supported reference types,
 * ensuring type safety across the entire reference system.
 */
export const oasRefData: v.GenericSchema<OasRefData> = v.union([
  oasSchemaRefData,
  oasResponseRefData,
  oasParameterRefData,
  oasExampleRefData,
  oasRequestBodyRefData,
  oasHeaderRefData,
  oasSecuritySchemeRefData
  // oasPathItemRefData
])
