import * as v from 'valibot'

/**
 * Valibot schema for validating OpenAPI unknown data objects.
 * 
 * Validates unknown/unspecified schemas used as fallbacks when
 * schema types cannot be determined or for flexible data handling.
 */
export const oasUnknownData: v.GenericSchema<OasUnknownData> = v.object({
  oasType: v.literal('schema'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.unknown()),
  type: v.literal('unknown')
})

/**
 * Data type for OpenAPI unknown schema objects.
 * 
 * Represents schemas with unspecified or flexible types, used as
 * fallbacks when schema types cannot be determined or when maximum
 * flexibility is required in the API specification.
 */
export type OasUnknownData = {
  /** Type category identifier for schema objects */
  oasType: 'schema'
  /** Human-readable title for the unknown schema */
  title?: string
  /** Detailed description of the schema's purpose */
  description?: string
  /** Default value of any type */
  default?: unknown
  /** Type identifier (always 'unknown') */
  type: 'unknown'
}
