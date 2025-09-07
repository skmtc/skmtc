import * as v from 'valibot'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.ts'

/**
 * Valibot schema for validating OpenAPI array data objects.
 * 
 * Validates array schemas including item type definitions, length constraints,
 * uniqueness requirements, and enumeration values. Uses lazy evaluation
 * to handle recursive schema references.
 */
export const oasArrayData: v.GenericSchema<OasArrayData> = v.object({
  type: v.literal('array'),
  items: v.lazy(() => v.union([v.lazy(() => oasSchemaData), oasSchemaRefData])),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.array(v.unknown())),
  maxItems: v.optional(v.number()),
  minItems: v.optional(v.number()),
  uniqueItems: v.optional(v.boolean()),
  enums: v.optional(v.array(v.unknown()))
})

/**
 * Data type for OpenAPI array schema objects.
 * 
 * Represents array schemas with item type specifications, length constraints,
 * and validation rules. Used throughout the SKMTC pipeline for array type
 * processing and code generation.
 */
export type OasArrayData = {
  /** Type identifier (always 'array') */
  type: 'array'
  /** Schema definition for array items */
  items: OasSchemaData | OasSchemaRefData
  /** Human-readable title for the array */
  title?: string
  /** Detailed description of the array's purpose */
  description?: string
  /** Default value for the array */
  default?: unknown[]
  /** Maximum number of items allowed */
  maxItems?: number
  /** Minimum number of items required */
  minItems?: number
  /** Whether all items must be unique */
  uniqueItems?: boolean
  /** Array of valid enumeration values */
  enums?: unknown[]
}
