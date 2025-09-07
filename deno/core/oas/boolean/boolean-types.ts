import * as v from 'valibot'

/**
 * Valibot schema for validating OpenAPI boolean data objects.
 * 
 * Validates boolean schemas including default values and enumeration
 * constraints. Boolean enums typically contain [true, false] or single values.
 */
export const oasBooleanData = v.object({
  type: v.literal('boolean'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.boolean()),
  enum: v.optional(v.array(v.boolean()))
})

/**
 * Data type for OpenAPI boolean schema objects.
 * 
 * Represents boolean schemas with optional default values and enumeration
 * constraints. Used throughout the SKMTC pipeline for boolean type
 * processing and code generation.
 */
export type OasBooleanData = {
  /** Type identifier (always 'boolean') */
  type: 'boolean'
  /** Human-readable title for the boolean */
  title?: string
  /** Detailed description of the boolean's purpose */
  description?: string
  /** Default value for the boolean */
  default?: boolean
  /** Array of valid boolean values (typically [true], [false], or [true, false]) */
  enum?: boolean[]
}
